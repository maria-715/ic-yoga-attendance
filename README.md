# IC Yoga Attendance App

Full-stack web application developed for the Yoga Society of Imperial College London to manage class attendance, ticket usage, and synchronisation with the Imperial College Union API.

Built with Next.js and TypeScript, the application integrates external API data, implements multi-use ticket validation logic, and uses Firebase Firestore for persistent storage related to users, tickets, and classes. The system has been designed for society coordinators to manage classes and attendance records.

## Tech Stack
- Next.js (React)
- TypeScript
- Firebase Firestore
- Tailwind CSS
- REST API integration (Imperial College Union)

## Running the webapp

Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the app.


## Before starting

> [!WARNING]
> This is to be done only once, which is when the webapp is officially being set up.

1. Delete on firebase the collections `classes`, `users`, and `orders`.
2. Set `lastUpdated` field in the `general` collections as needed, for example to the day before the start of the academic year.
3. Update the database as explained below.


## Updating the Database

Firestore database is updated from the Union API.

1. Start the backend.

```
node src/router.js
```

2. Ensure an `.env` file in your main folder, containing the following line:
```
EACTIVITIES_API_KEY={API_KEY}
```
> `API_KEY` can be found on EActivities and is not surrounded by any quotes.

3. Click Update in the web app to synchronise the database.


## Adding a Class

1. Click **Add Class**.

2. Fill mandatory `time` and upload the CSV file (found on EActivities).

3. Specify ticket IDs to use. Leave empty for default tickets (10-class pass, single member ticket, single non-member ticket).

4. Submitting an already-existing class (i.e. same date and time):
- Overwrites valid products and participants
- Appends new notes to existing ones


## Architecture

### Local Data Structures

The app uses two main representations of a Yoga Class:

#### General Class

- Each class' `id` is its date in `YYYYMMDDHHmm` format.
```
General Class
- id: string
- time: string (with format "ddd DD/MM")
```

#### Class (extends GeneralClass)

- Tickets from the Union API have `productId` and `productLineId`. Several tickets with different `productLineId` can have the same `productId`.
- The `notes` field allows coordinators to add comments for the class.
```
Class extends General Class
- participants: Participant[]
- validTickets: { productId: number, productLineId: number }[]
- notes: string
```

#### Participant

- Participant's `id` is their user id.
- `missingClassPass` is relevant only when a participant uses their 10-class pass. Coordinators tick the field when participant forget to bring their pass, as a reminder to tick the pass next time.

```
Participant
- id: string
- user: User
- attended: boolean
- missingClassPass: boolean
```

#### User

- Most of the information comes from the Union API.
- `isMember` is not up-to-date and should be either handled or properly removed.

```
User
id: string
firstName: string
surname: string
isMember: boolean
orders: Order[]
```

#### Order

- Order's `id` comes from the Union.
- `numerTotal` is the number of times an order can be used as a ticket. The standard is:
    - 10 for a 10-class pass
    - 0 for a membership order
    - 1 for any type of other ticket.
- `classes` is an array of tuples `(yogaClass, ticked)`. `ticked` is only relevant for class passes and is completely ignored and always set to `false` for any other kind of orders.
- The logic of `statusClassPass` is detailed below but it helps track missing ticks per user.

> [!IMPORTANT]
> Classes must always be sorted from earliest to latest.

```
Orders
- id: string
- productId: number
- productLineId: number
- numTotal: number
- classes: {yogaClass: GeneralClass, ticked: boolean}[]
- statusClassPass: StatusClassPass
```

---

### Firestore Structure

#### Classes collection

- Subcollection `participants` may not exist; this indicates that no participants were provided in the CSV when adding a new class.

```
classes/[YYYYMMDDHHmm]
- participants (subcollection)
- notes (string)
- time (string)
- validTickets (array of maps {productId, productLineId})
```

#### Participant Subcollection

```
classes/[YYYYMMDDHHmm]/participants/[userId]
- attended (boolean)
- missingClassPass (boolean)
- user (reference)
```

#### Users Collection

```
users/[userId]
- cid (string)
- email (string)
- firstName (string)
- isMember (boolean)
- orders (array of references)
- surname (string)
```

#### Orders Collection

```
orders/[orderId]
- classes (array of references)
- numTotal (number)
- productId (number)
- productLineId (number)
- statusClassPass (string)
```

#### Update tracking

- `lastUpdated` indicates the last time the Firestore database was updated from the Union database.

```
general/update
- lastUpdated: string (format "YYYY-MM-DD HH:mm:ss")
```


## Logic of missing ticks

#### StatusClassPass Enum

Each order has a statusClassPass field.

```
enum StatusClassPass
- NotApplicable
- AllTicked
- MissingTicks
- InUse
```

- `NotApplicable`: Non-10-class pass orders. Ignored.
- `AllTicked`: Pass not full but in use.
- `MissingTicks`: Pass full, some ticks missing.
- `InUse`: Pass fully used and ticked.

#### Core Logic

1. UI shows missing ticks per user.
2. Clicking attended assumes all missing ticks are ticked
3. Clicking forgot class pass after attendance:
    - Adds this class to missing ticks
    - "Restores" previous missing ticks (in reality, they are always untouched)
4. Only the current class's `ticked` field is updated. Not the `ticked` field of all previous classes. For efficiency and helps remembering  which classes were initially missing tickets, in the case where we set **Forgot class pass** to *true*.
5. `classes` must remain chronologically sorted:
    - If a class in an order is ticked, all previous classes in that order are assumed ticked.

#### Known issue

- Unchecking attendance of an old class-pass while a newer in-use class-pass already contains classes may break the logic regarding the missing ticks. Indeed, at some point, if we add a new class, it will be stored in the old class-pass `classes`. If there are missing ticks somewhere, the logic can be broken.
- May occur if a coordinator made a mistake.
- Might be handled individually, e.g., allowing free attendance for the affected class, or look into the data structure logic.



## Improvements and future to-dos

- Add an Imperial/Google login system to access the website and its main page. To access a class, a permission is needed.

- Implement caching to reduce Firestore reads. Example: for user tickets, cache tickets after first fetch; getCurrentTicket first checks cache before querying Firestore.

- Review missing class pass logic for edge cases as presented above.

- Handle or remove `isMember` in `User`.

- Use `arrayUnion` in `UpdateDatabase.tsx`.

- Consider automatic daily database updates (optional).

### UI Details

- **IC Yoga** and **Settings** are not correctly aligned in the header.
- Change icons from the toolbar.
