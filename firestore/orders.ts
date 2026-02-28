import { DocumentData, DocumentReference, QueryDocumentSnapshot } from "firebase/firestore";
import { GeneralClass, getGeneralClassInformation } from "./classes";
import { fromStringToStatusClassPass, ID_10_CLASS_PASS, LINE_ID_10_CLASS_PASS, StatusClassPass } from "@/global";

export class Order {

    id: string;

    // Details of the bought product
    productId: number;
    productLineId: number;

    // How many times the order can be used (generally, 1 except when a 10-class pass is bought)
    numTotal: number;

    // The classes the order has been used for and, regarding the class passes, if the class has been ticked
    // On firestore, it is {DocumentReference, boolean}[]
    // We always sort classes locally but not on firestore (to potentially modify)
    classes: {yogaClass: GeneralClass, ticked: boolean}[];

    statusClassPass: StatusClassPass;


    // ================================ Constructing ========================================

    constructor(id: string, productId: number, productLineId: number, numTotal: number, 
                classes: {yogaClass: GeneralClass, ticked: boolean}[], statusClassPass: StatusClassPass) {
        this.id = id;
        this.productId = productId;
        this.productLineId = productLineId;
        this.numTotal = numTotal;
        this.classes = classes;
        this.statusClassPass = statusClassPass;

        // classes should always be sorted from earliest to latest
        this.sortClasses();
    }
    

    static async fromSnapshot(order: QueryDocumentSnapshot<DocumentData, DocumentData>) {

        // Verifying that no attribute is missing
        const data = order.data();
        if (typeof data.productId !== "number") {
            throw new Error(`Order ${order.id} is missing or has invalid "productId"`);
        }
        if (typeof data.productLineId !== "number") {
            throw new Error(`Order ${order.id} is missing or has invalid "productLineId"`);
        }
        if (typeof data.numTotal !== "number") {
            throw new Error(`Order ${order.id} is missing or has invalid "numTotal"`);
        }
        if (!Array.isArray(data.classes)) {
            throw new Error(`Order ${order.id} is missing or has invalid "classes" array`);
        }
        if (typeof data.statusClassPass !== "string") {
            throw new Error(`Order ${order.id} is missing or has invalid "statusClassPass"`);
        }

        const classData = data.classes;

        const yogaClasses: { yogaClass: GeneralClass, ticked: boolean }[] = (await Promise.all(
            classData.map(async (c: { classRef: DocumentReference, ticked: boolean }) => {

                const generalClass = await getGeneralClassInformation(c.classRef.id);
                if (generalClass == null) {
                    return null;
                }

                return {
                    yogaClass: generalClass,
                    ticked: c.ticked
                };
            })
        )).filter(c => c !== null);

        return new Order(order.id, data.productId, data.productLineId, 
                         data.numTotal, yogaClasses, 
                         fromStringToStatusClassPass(data.statusClassPass));
    }


    // If (class, ticked) (element from the array this.classes) has been ticked, then it means that this 
    // class and all the previous ones on the class pass have been ticked
    public calculateStatusClassPass() {

        if (this.productId == ID_10_CLASS_PASS && this.productLineId == LINE_ID_10_CLASS_PASS) {

            if (this.classes.length < this.numTotal) {
                return StatusClassPass.InUse;
            } else if (this.classes[this.classes.length-1].ticked) {
                return StatusClassPass.AllTicked;
            } else {
                return StatusClassPass.MissingTicks;
            }
        }
        return StatusClassPass.NotApplicable;
    }


    public getNumberMissingTicks() {

        if (this.statusClassPass == StatusClassPass.InUse || this.statusClassPass == StatusClassPass.MissingTicks) {

            let missing = 0;
            for (let i = this.classes.length-1; i >= 0; i--) {
                if (this.classes[i].ticked) break;
                missing++;
            }

            return missing;
        }

        return 0;
    }


    public sortClasses() {

        this.classes.sort((c1, c2) => GeneralClass.compare(c1.yogaClass, c2.yogaClass));

    }


    public isOlder(other: Order) {

        // return false if this is empty
        if (this.classes.length == 0) {
            return false;
        }

        const thisLastClass = this.classes[this.classes.length-1].yogaClass;
        const otherLastClass = other.classes[other.classes.length-1].yogaClass;

        return GeneralClass.compare(thisLastClass, otherLastClass) < 0;

    }


    public clone() {

        return new Order(this.id, this.productId, this.productLineId, this.numTotal, this.classes, this.statusClassPass);

    }

}
