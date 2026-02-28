import { db } from "./firebaseConfig";
import { collection, doc, DocumentData, DocumentReference, getDoc, getDocs, query, QueryDocumentSnapshot, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import moment from "moment";
import { Participant } from "./participants";
import Papa from "papaparse";
import { User } from "./users";


// Class containing the general informations of a class (without any details)
export class GeneralClass {

    id: string;
    time: string;

    // ================================ Constructing ========================================

    constructor(id: string, time: string) {
        this.id = id;
        this.time = time;
    }

    static async fromSnapshot(yogaClass: QueryDocumentSnapshot<DocumentData, DocumentData>) {
        
        // Verifying all attributes are present
        const data = yogaClass.data();
        if (!data.time) {
          throw new Error(`GeneralClass ${yogaClass.id} is missing the "time" field in Firestore`);
        }

        // Handle time
        const fullDate = moment(data.time);
        const formattedDate = fullDate.format("ddd DD/MM");

        return new GeneralClass(yogaClass.id, formattedDate);
    }

    // ================================= Tools ==========================================

    // Positive number => c1 is later than c2
    static compare(c1: GeneralClass, c2: GeneralClass) {
        const y1 = parseInt(c1.id.substring(0, 4));
        const m1 = parseInt(c1.id.substring(4, 6)) - 1; // Month is 0-indexed
        const d1 = parseInt(c1.id.substring(6, 8));
        const h1 = parseInt(c1.id.substring(8, 10));
        const min1 = parseInt(c1.id.substring(10, 12));

        const y2 = parseInt(c2.id.substring(0, 4));
        const m2 = parseInt(c2.id.substring(4, 6)) - 1; // Month is 0-indexed
        const d2 = parseInt(c2.id.substring(6, 8));
        const h2 = parseInt(c2.id.substring(8, 10));
        const min2 = parseInt(c2.id.substring(10, 12));

        return (new Date(y1, m1, d1, h1, min1)).getTime() - (new Date(y2, m2, d2, h2, min2)).getTime();
    }
}


// Class containing all the detailed informations of a yoga class
export class Class extends GeneralClass {

    participants: Participant[];

    // All the type of tickets that can be used for this yoga class
    validTickets: { productId: number, productLineId: number }[];

    // Random notes from the coordinators
    notes: string;

    // ================================ Constructing ========================================

    constructor(id: string, time: string, participants: Participant[], 
                validTickets: { productId: number, productLineId: number }[], notes: string) {
                  
        super(id, time);
        this.participants = participants;
        this.validTickets = validTickets;
        this.notes = notes;
    }

    static async fromSnapshot(yogaClass: QueryDocumentSnapshot<DocumentData, DocumentData>) {

        // Verifying that no attribute is missing
        const data = yogaClass.data();
        if (!data.time) {
            throw new Error(`Class ${yogaClass.id} is missing the "time" field in Firestore`);
        }
        if (!Array.isArray(data.validTickets)) {
            throw new Error(`Class ${yogaClass.id} is missing a valid "validTickets" array in Firestore`);
        }
        if (typeof data.notes !== "string") {
            throw new Error(`Class ${yogaClass.id} is missing the "notes" field in Firestore`);
        }

        // Handle time
        const fullDate = moment(data.time);
        const formattedDate = fullDate.format("ddd DD/MM HH:mm");

        // Handle participants
        // The collection in firebase doesn't exist if no participants were in the csv file given in "add_class"
        const participantsQuerySnapshot = await getDocs(collection(db, "classes", yogaClass.id, "participants"));

        const participants = await Promise.all(
            participantsQuerySnapshot.docs.map(async (docSnapshot: any) => {
                return docSnapshot.exists() ? 
                  Participant.fromSnapshot(docSnapshot as QueryDocumentSnapshot<DocumentData>) 
                  : null;
            })
        );

        const validParticipants = participants
                                  .filter(p => p !== null)
                                  .sort((a, b) => a.user.surname.localeCompare(b.user.surname)) as Participant[];

        const validTickets = data.validTickets;

        const notes = data.notes;

        return new Class(yogaClass.id, formattedDate, validParticipants, validTickets, notes);
    }


    // ================================ Updating ========================================

    async updateNotesStatus(notes: string) {

        if (this.notes === notes) return this;

        // Update local copy
        this.notes = notes;

        // Update firestore copy
        try {
          const classRef = doc(db, "classes", this.id);
          await updateDoc(classRef, {
              notes: notes
          });
        } catch (error) {
          throw new Error(`Error saving the notes in the database.\n${error}`);
        }        

        return this;
    }


    async updateAttendedStatus(participant: Participant, attended: boolean) {

        if (participant.attended == attended) return this;

        const newUser = await participant.user.updateTicket(this, attended);
        if (newUser == null) throw new Error("Could not update user's attended status\n");

        // Update local copy (by returning new state)
        const updatedParticipants = this.participants.map(p =>
            p.id === participant.id ? new Participant(p.id, newUser, attended, p.missingClassPass) : p
        );

        // Update firestore copy
        try {

          const participantInClassRef = doc(db, "classes", this.id, "participants", participant.id);
          await updateDoc(participantInClassRef, {attended: attended});

        } catch (error) {
          throw new Error(`Error saving the attendance in the database.\n${error}`);
        }

        // This solution makes things not immutable anymore but is needed to render everything again in page.tsx
        return new Class(this.id, this.time, updatedParticipants, this.validTickets, this.notes);
    }


    async updateHasClassPassStatus(participant: Participant, missingClassPass: boolean) {

        if (participant.missingClassPass == missingClassPass) return this;

        const newUser = await participant.user.updateMissingTickOnPass(this, missingClassPass);

        // Update local copy (by returning new state)
        const updatedParticipants = this.participants.map(p =>
            p.id === participant.id ? new Participant(p.id, newUser, p.attended, missingClassPass) : p
        );

        // Update firestore copy
        try {
          const participantInClassRef = doc(db, "classes", this.id, "participants", participant.id);
          await updateDoc(participantInClassRef, {missingClassPass: missingClassPass});

        } catch (error) {
          throw new Error(`Error saving needed ticks in class pass in the database.\n${error}`);
        }

        // This solution makes things not immutable anymore but is needed to render everything again in page.tsx
        return new Class(this.id, this.time, updatedParticipants, this.validTickets, this.notes);
    }

    
    async addParticipant(user: User) {

        // Update local list of participants
        const newParticipant = new Participant(user.id, user, false, false);
        const updatedParticipants = this.participants.concat([newParticipant]);

        // Update firestore copy

        try {
          const classRef = doc(db, "classes", this.id);

          // We assume that the class snapshot exists

          const userRef = doc(db, "users", user.id);
          const participantRef = doc(classRef, "participants", user.id);
          await setDoc(participantRef, {
              user: userRef,
              attended: false,
              missingClassPass: false
          });

        } catch (error) {
            throw new Error(`Error adding a participant in the database.\n${error}`);
        }
        
        return new Class(this.id, this.time, updatedParticipants, this.validTickets, this.notes);
    }


}


// ============================= General information =============================

export async function getAllClasses() {

    try {
      const querySnapshot = await getDocs(collection(db, "classes"));

      const data: GeneralClass[] = [];
      for (const yogaClass of querySnapshot.docs) {
          data.push(await GeneralClass.fromSnapshot(yogaClass));
      }

      return data;

    } catch (error) {
      throw new Error(`Error getting all the classes from the database.\n${error}`);
    }   

}


export async function getFutureClasses() {

    try {
      const q = query(collection(db, "classes"))
      const querySnapshot = await getDocs(q);

      const data: GeneralClass[] = [];
      const endOfWeek = moment().endOf("isoWeek");
      for (const yogaClass of querySnapshot.docs) {
          const fullDate = moment(yogaClass.data().time);

          if (fullDate.isAfter(endOfWeek, "day")) {
                data.push(await GeneralClass.fromSnapshot(yogaClass));
          }
      };

      return data;

    } catch (error) {
      throw new Error(`Error getting all the future classes from the database.\n${error}`);
    }
}

export async function getPastClasses() {

    try {
      const q = query(collection(db, "classes"))
      const querySnapshot = await getDocs(q);

      const data: GeneralClass[] = [];
      for (const yogaClass of querySnapshot.docs) {
          const fullDate = moment(yogaClass.data().time);

          let startOfWeek = moment().startOf("isoWeek");
          if (moment().get("day") == 0) {
              startOfWeek.subtract(6, "days");
          } else {
              startOfWeek.add(1, "days");
          }

          if (fullDate.diff(startOfWeek) < 0) {
              data.push(await GeneralClass.fromSnapshot(yogaClass));
          }
      };

      return data;

    } catch (error) {
      throw new Error(`Error getting all the past classes from the database.\n${error}`);
    }
}


export async function getThisWeekClasses() {

    try {
      const q = query(collection(db, "classes"))
      const querySnapshot = await getDocs(q);

      const data: GeneralClass[] = [];
      for (const yogaClass of querySnapshot.docs) {
          const fullDate = moment(yogaClass.data().time);

          let startOfWeek = moment().startOf("isoWeek");
          let endOfWeek = moment().endOf("isoWeek");
          if (moment().get("day") == 0) {
              startOfWeek.subtract(6, "days");
              endOfWeek.subtract(6, "days");
          } else {
              startOfWeek.add(1, "days");
              startOfWeek.add(1, "days");
          }

          if (fullDate.diff(startOfWeek) >= 0 && endOfWeek.diff(fullDate) >= 0) {
              data.push(await GeneralClass.fromSnapshot(yogaClass));
          }
      };

      return data;

    } catch (error) {
      throw new Error(`Error getting this week's classes from the database.\n${error}`);
    }
}


export async function getGeneralClassInformation(id: string) {

    try {
      const classRef = doc(db, "classes", id);
      const classSnapshot = await getDoc(classRef);

      if (classSnapshot.exists()) {
          return await GeneralClass.fromSnapshot(classSnapshot);
      }

      return null;

    } catch (error) {
      throw new Error(`Error getting the general information of class ${id}.\n${error}`);
    }
}


// =========================== Specific information ==================================

export async function getClassInformation(id: string) {
    try {
      const classRef = doc(db, "classes", id);
      const classSnapshot = await getDoc(classRef);

      if (classSnapshot.exists()) {
          return await Class.fromSnapshot(classSnapshot);
      }

      return null;
    
    } catch (error) {
      throw new Error(`Error getting the detailed information of class ${id}.\n${error}`);
    }
}


// =========================== Creating a class ==================================

export async function createClass(classTime: string, validTickets: { productId: number, productLineId: number }[],
                                  notes: string, csvFile: File) {

    try {

      // 1) Create a class with this time, if already exists then it will update participants and 
      // valid tickets but not notes

      // Convert "YY-DD-MM HH:mm" to "YYDDMMHHmm" (will be the id of the class)
      const parts = classTime.split(/[- :]/);

      const [yy, mm, dd, hh, min] = parts;
      const id = `${yy}${mm}${dd}${hh}${min}`;
    
      const classRef = doc(collection(db, "classes"), id);
      const docSnap = await getDoc(classRef);

      if (docSnap.exists()) {

        const existingNotes = docSnap.data().notes || "";
        const newNotes = existingNotes !== "" ? `${existingNotes}\n${notes}` : notes;
        
        await updateDoc(classRef, {
          validTickets: validTickets,
          notes: newNotes
        });

      } else {

        await setDoc(classRef, { time: classTime, validTickets: validTickets, notes: notes });

      }

      await new Promise<void>((resolve, reject) => {
        if (csvFile) {
          Papa.parse<any>(csvFile, {
            header: true,
            skipEmptyLines: true,
            complete: async function (results: Papa.ParseResult<any>) {

              try {

                // 2) Loop on the csv file
                  // Fetch each user and add it to the array
                  // If the user isn't in the database, just leave a message but skip

                const rows = results.data;

                const participants: DocumentReference[] = (await Promise.all(
                  rows.map(async (row: any) => {

                    const login = row["Login"];
                    const userRef = doc(collection(db, "users"), login);
                    const docSnap = await getDoc(userRef);

                    if (!docSnap.exists()) {
                      
                      await setDoc(userRef, {
                        cid: row["CID/Card Number"],
                        login: login,
                        firstName: row["First Name"],
                        surname: row["Surname"],
                        email: row["Email"],
                        isMember: false,
                        orders: [],
                        nbMissingTicksOnPass: 0
                      });

                    }

                    return userRef;

                  })
                )).filter((ref: DocumentReference | null) => ref !== null)

                // 3) Create a participant collection and fill it with the array information

                const batch = writeBatch(db);
                for (const userRef of participants) {
                  const participantRef = doc(collection(classRef, "participants"), userRef.id);
                  batch.set(participantRef, {
                    user: userRef,
                    attended: false,
                    missingClassPass: false
                  });
                }
                await batch.commit();
                resolve();

              } catch (error) {
                reject(error);
              }
            },
            error (error: Error) {
              console.error("Error parsing CSV:", error);
              reject(error);
            }
          });
        }
      });
    
    } catch (error) {
      throw new Error(`Error while creating class at time ${classTime}.\n${error}`);
    }

}
