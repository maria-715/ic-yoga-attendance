import { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { getUserInformation, User } from "./users";

export class Participant {
    id: string;
    user: User;
    attended: boolean;
    missingClassPass: boolean; // Relevant when the ticket used is a 10-class pass

    constructor(id: string, user: User, attended: boolean, missingClassPass: boolean) {
        this.id = id;
        this.user = user;
        this.attended = attended;
        this.missingClassPass = missingClassPass;
    }

    static async fromSnapshot(participant: QueryDocumentSnapshot<DocumentData, DocumentData>) {

        // Verifying that no attribute is missing
        const data = participant.data();
        if (!data.user || !data.user.id) {
            throw new Error(`Participant ${participant.id} is missing "user.id"`);
        }
        if (typeof data.attended !== "boolean") {
            throw new Error(`Participant ${participant.id} is missing or has invalid "attended"`);
        }
        if (typeof data.missingClassPass !== "boolean") {
            throw new Error(`Participant ${participant.id} is missing or has invalid "missingClassPass"`);
        }
        
        const user = await getUserInformation(data.user.id);
        if (user == null) return null;
        return new Participant(participant.id, user, data.attended, data.missingClassPass);

    }

}
    