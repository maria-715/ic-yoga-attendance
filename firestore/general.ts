import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

export async function getLastUpdated() {

    try {

        const updateRef = doc(db, "general", "update");
        const updateSnapshot = await getDoc(updateRef);

        if (!updateSnapshot.exists()) {
            return null;
        }
        return updateSnapshot.data().lastUpdated;

    } catch (error) {
        throw new Error(`Error getting when the database was last updated.\n${error}`);
    }

}


function formatDateToString(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
           `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}


export async function changeLastUpdated() {

    try {
        const now = new Date();
        const formatted = formatDateToString(now);

        const updateRef = doc(db, "general", "update");
        await setDoc(updateRef, { lastUpdated: formatted }, { merge: true });

    } catch (error) {
        throw new Error(`Error while saving in the database the time of its last update.\n${error}`);
    }

}