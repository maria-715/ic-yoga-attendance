
// Month when the new academic year starts (e.g. August)
export const MONTH_NEW_ACADEMIC_YEAR = 8

// These passes are not from 2024-2025 but are still being sold
export const ID_10_CLASS_PASS = 47764;
export const LINE_ID_10_CLASS_PASS = 79740;

export const ID_SINGLE_CLASS_MEMBER = 47776;
export const LINE_ID_SINGLE_CLASS_MEMBER = 79759;

export const ID_SINGLE_CLASS_NON_MEMBER = 47777;
export const LINE_ID_SINGLE_CLASS_NON_MEMBER = 79760;

export const DEFAULT_TICKETS = [
        { productId: ID_10_CLASS_PASS, productLineId: LINE_ID_10_CLASS_PASS },
        { productId: ID_SINGLE_CLASS_MEMBER, productLineId: LINE_ID_SINGLE_CLASS_MEMBER },
        { productId: ID_SINGLE_CLASS_NON_MEMBER, productLineId: LINE_ID_SINGLE_CLASS_NON_MEMBER },
    ]

// For the year 2024-2025
export const ID_MEMBERSHIP = 50311;
export const LINE_ID_MEMBERSHIP = 83799;

// To keep track of class passes that have all been used but are missing ticks
export const enum StatusClassPass {
    NotApplicable, AllTicked, MissingTicks, InUse
}

export function fromStringToStatusClassPass(string: string) {
    switch (string) {
        case "allTicked":
            return StatusClassPass.AllTicked;
        case "missingTicks":
            return StatusClassPass.MissingTicks;
        case "inUse":
            return StatusClassPass.InUse;
        default:
            return StatusClassPass.NotApplicable;
    }
}

export function fromStatusClassPassToString(scp: StatusClassPass) {
    switch (scp) {
        case StatusClassPass.NotApplicable:
            return "notApplicable";
        case StatusClassPass.AllTicked:
            return "allTicked";
        case StatusClassPass.MissingTicks:
            return "missingTicks";
        case StatusClassPass.InUse:
            return "inUse";
    }
}
