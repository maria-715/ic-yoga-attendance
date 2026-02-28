import { db } from "./firebaseConfig";
import { getDoc, getDocs, collection, doc, QueryDocumentSnapshot, DocumentData, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { Order } from "./orders";
import { Class, getGeneralClassInformation } from "./classes";
import { fromStatusClassPassToString, ID_10_CLASS_PASS, LINE_ID_10_CLASS_PASS, StatusClassPass } from "@/global";

export class User {
    id: string;
    firstName: string;
    surname: string;
    isMember: boolean;
    orders: Order[];

    constructor(id: string, firstName: string, surname: string, isMember: boolean, orders: Order[]) {
        this.id = id;
        this.firstName = firstName;
        this.surname = surname;
        this.isMember = isMember;
        this.orders = orders;
    }


    // ================================ Constructing ========================================

    static async fromSnapshot(user: QueryDocumentSnapshot<DocumentData, DocumentData>) {

        // Verifying that no attribute is missing
        const data = user.data();
        if (typeof data.firstName !== "string") {
            throw new Error(`User ${user.id} is missing or has invalid "firstName"`);
        }
        if (typeof data.surname !== "string") {
            throw new Error(`User ${user.id} is missing or has invalid "surname"`);
        }
        if (typeof data.isMember !== "boolean") {
            throw new Error(`User ${user.id} is missing or has invalid "isMember"`);
        }
        if (!Array.isArray(data.orders)) {
            throw new Error(`User ${user.id} is missing or has invalid "orders" array`);
        }

        // Handle orders
        const orderRefs = data.orders;

        const orders = await Promise.all(
            orderRefs.map(async (o: any) => {
                const docSnapshot = await getDoc(o);
                return docSnapshot.exists() ? 
                       Order.fromSnapshot(docSnapshot as QueryDocumentSnapshot<DocumentData>) 
                       : null;
            })
        );

        const validOrders = orders.filter(o => o !== null) as Order[];

        // Return user
        return new User(user.id, data.firstName, data.surname, data.isMember, validOrders);
    }


    // ================================= Getting =========================================

    // Among the list of valid class tickets
    async getCurrentTicket(classId: string, classValidTickets: { productId: number, productLineId: number }[]) {

        const alreadyUsed = this.orders.find(o => classValidTickets.some(t => t.productId === o.productId 
                                                  && t.productLineId === o.productLineId)
                                                  && (o.numTotal === o.classes.length)
                                                  && (o.classes.some(c => c.yogaClass.id === classId)));
        if (alreadyUsed != undefined) return alreadyUsed;

        const currentlyUsing = this.orders
            
            .filter(o => classValidTickets.some(t => t.productId === o.productId 
                                                && t.productLineId === o.productLineId) 
                                                && (o.classes.length as number) < (o.numTotal as number))

            // Put 10-class passes first
            .sort((o1, o2) => {

                const isO1TenClass =
                    o1.productId === ID_10_CLASS_PASS &&
                    o1.productLineId === LINE_ID_10_CLASS_PASS;
                const isO2TenClass =
                    o2.productId === ID_10_CLASS_PASS &&
                    o2.productLineId === LINE_ID_10_CLASS_PASS;

                if (isO1TenClass && !isO2TenClass) return -1;
                if (!isO1TenClass && isO2TenClass) return 1;

                return 0;
            });
            
        if (currentlyUsing.length == 0) return null;
        
        return currentlyUsing.slice().sort((o1, o2) => -((o1.classes.length as number) - (o2.classes.length as number)))[0];        

    }


    public getTotalNbMissingTicksOnPasses() {
        let res = 0;
        for (const order of this.orders) {
            res += order.getNumberMissingTicks();
        }
        return res;
    }


    // ================================= Updating =======================================

    // Handle when several different passes can be used
    // Updating if a ticket has been used or not
    async updateTicket(yogaClass: Class, attended: boolean) {
        if (attended) {

            // Change current ticket
            const currentTicket = await this.getCurrentTicket(yogaClass.id, yogaClass.validTickets);
            if (currentTicket != null) {

                // Update locally
                const addedClass = await getGeneralClassInformation(yogaClass.id);
                if (addedClass === null) return; // What should happen? Should never happen
                currentTicket.classes.push({yogaClass: addedClass, ticked: true});

                // Extremely important!
                currentTicket.sortClasses();
                currentTicket.statusClassPass = currentTicket.calculateStatusClassPass();

                // Update on firestore
                try {
                    const currentTicketRef = doc(db, "orders", currentTicket.id);
                    const currentTicketSnapshot = await getDoc(currentTicketRef);
            
                    if (currentTicketSnapshot.exists()) {

                        const toAdd = {
                            classRef: doc(db, "classes", yogaClass.id),
                            ticked: true
                        };

                        await updateDoc(currentTicketRef, { classes: arrayUnion(toAdd), statusClassPass: fromStatusClassPassToString(currentTicket.statusClassPass) });

                    }

                } catch (error) {
                    throw new Error(`Error when saving the attendance on the database.\n${error}`);
                }

            } else {
                throw new Error("Can't update the attendance because the user has no current ticket.");
            }    
            

            // Change status of all previous tickets
            // BE CAREFUL BECAUSE IN THEORY IT DOESN'T CHANGE ONLY ON PREVIOUS TICKETS. IT COULD CHANGE 
            // THOSE THAT ARE AFTER. To solve this, remember that the ids of classes are according to their
            // dates.
            for (const order of this.orders) {

                if (order.id != currentTicket.id) {
                    if (order.statusClassPass == StatusClassPass.MissingTicks && order.isOlder(currentTicket)) {

                        // Update locally
                        order.statusClassPass = StatusClassPass.AllTicked;

                        // Update on firestore
                        try {
                            const orderRef = doc(db, "orders", order.id);
                            // We assume that the snapshot always exist

                            await updateDoc(orderRef, { statusClassPass: fromStatusClassPassToString(StatusClassPass.AllTicked) });

                        } catch (error) {
                            throw new Error(`Error when saving the attendance on the database.\n${error}`);
                        }
                    }
                }
            }

        } else {

            for (const order of this.orders) {
                
                // Handle the current ticket
                if (order.classes.some(c => c.yogaClass.id === yogaClass.id)) {
                    
                    // Update locally
                    order.classes = order.classes.filter(c => c.yogaClass.id !== yogaClass.id);
                    order.statusClassPass = order.calculateStatusClassPass();
                    
                    // Update on firestore
                    try {
                        const currentTicketRef = doc(db, "orders", order.id);
                        // We assume that the snapshot always exist

                        const toRemove = {
                            classRef: doc(db, "classes", yogaClass.id),
                            ticked: true
                        };

                        await updateDoc(currentTicketRef, { classes: arrayRemove(toRemove), statusClassPass: fromStatusClassPassToString(order.statusClassPass) });

                    } catch (error) {
                        throw new Error(`Error when saving the attendance on the database.\n${error}`);
                    }
                }

                // Change the status of all previous tickets
                else if (order.statusClassPass == StatusClassPass.AllTicked && !order.classes[order.classes.length-1].ticked) {

                    // Update locally
                    order.statusClassPass = StatusClassPass.MissingTicks;

                    // Update on firestore
                    try {
                        const orderRef = doc(db, "orders", order.id);
                        // We assume that the snapshot always exist

                        await updateDoc(orderRef, { statusClassPass: fromStatusClassPassToString(StatusClassPass.MissingTicks) });

                    } catch (error) {
                        throw new Error(`Error when saving the attendance on the database.\n${error}`);
                    }
                }
            }
        }

        return this.clone();
    }


    async updateMissingTickOnPass(yogaClass: Class, missingClassPass: boolean) {

        const currentTicket = await this.getCurrentTicket(yogaClass.id, yogaClass.validTickets);
        if (currentTicket !== null) {

            // Update locally
            const currentClass = currentTicket.classes.find(c => c.yogaClass.id === yogaClass.id);
            if (currentClass) {
                currentClass.ticked = !missingClassPass;
            } else {
                throw new Error("Can't update the number of missing ticks because no current ticket could be found for the user.");
            }

            currentTicket.statusClassPass = currentTicket.calculateStatusClassPass();

            // Update on firestore
            try {
                const currentTicketRef = doc(db, "orders", currentTicket.id);
                // We assume that the snapshot always exist

                // Assume that the ticked attribute is the opposite of the one that we want to save
                const toRemove = {
                    classRef: doc(db, "classes", yogaClass.id),
                    ticked: missingClassPass
                };
                await updateDoc(currentTicketRef, { classes: arrayRemove(toRemove) });

                const toAdd = {
                    classRef: doc(db, "classes", yogaClass.id),
                    ticked: !missingClassPass
                };
                await updateDoc(currentTicketRef, { classes: arrayUnion(toAdd), statusClassPass: fromStatusClassPassToString(currentTicket.statusClassPass) });

            } catch (error) {
                throw new Error(`Error saving the number of missing ticks on the database.\n${error}`);
            }

        } else {
            throw new Error("Can't update the number of missing ticks because the user has no current ticket.");
        } 
        
        for (const order of this.orders) {
            if (order.id === currentTicket.id) continue;

            if (order.isOlder(currentTicket)) {

                if (!missingClassPass) {
                    if (order.statusClassPass == StatusClassPass.MissingTicks) {
                        order.statusClassPass = StatusClassPass.AllTicked;
                    }
                } else {
                    if (order.statusClassPass == StatusClassPass.AllTicked && (!order.classes[order.classes.length-1].ticked 
                        || order.classes[order.classes.length-1].yogaClass.id == yogaClass.id)) {
                            order.statusClassPass = StatusClassPass.MissingTicks;
                        }
                }

                const newStatus = order.statusClassPass;

                try {
                    const orderRef = doc(db, "orders", order.id);
                    await updateDoc(orderRef, { statusClassPass: fromStatusClassPassToString(newStatus) });
                } catch (error) {
                    throw new Error(`Can't update the number of missing ticks for order ${order.id}.\n${error}`);
                }
            }
        }

        return this.clone();
    }


    // ================================= Tools =======================================

    public clone() {

        // Deep copy of orders
        return new User(this.id, this.firstName,this.surname, this.isMember, this.orders.map(o => o.clone()));

    }

}


// ============================== Get information ==================================

export async function getUserInformation(id: string) {

    try {

        const userRef = doc(db, "users", id);
        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
            return User.fromSnapshot(userSnapshot)
        }

        return null;
    
    } catch (error) {
        throw new Error(`Error while searching for user ${id} in database.\n${error}`);
    }

}


export async function getAllUsers() {
    try {
        const queryPromise = (await getDocs(collection(db, "users")))
                            .docs
                            .map(User.fromSnapshot);

        const data = await Promise.all(queryPromise); 
        return data;
    
    } catch (error) {
        throw new Error(`Error while getting all the users from the database.\n${error}`);
    }
}
