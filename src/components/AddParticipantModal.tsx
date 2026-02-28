import Modal from "react-modal";
import React, { useEffect, useState } from "react";
import { User } from "../../firestore/users";
import { Participant } from "../../firestore/participants";


export function AddParticipantModal({
    isOpen,
    onClose,
    users,
    participants,
}: {
    isOpen: boolean;
    onClose: (arg: User | null) => void;
    users: User[];
    participants: Participant[];
}) {
    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={() => onClose(null)}
            ariaHideApp={false}
            className="flex items-center justify-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-72 p-3 text-center text-white bg-[#1e7b97] rounded-xl"
        >
            <div className="flex flex-col font-sans">
                <div className="flex flex-row items-center justify-center">
                    <div className="text-xl">
                        Add participant
                    </div>
                    <button onClick={() => onClose(null)} className="absolute right-0 top-0 p-3">
                        X
                    </button>
                </div>
                <div className="flex flex-col w-fit my-3">
                    <div className="text-left">
                        Find user to add as participant:
                    </div>
                    <div className="">
                        <SearchBar users={users} participants={participants} onClose={onClose} />
                    </div>
                </div>
            </div>
        </Modal>
    )
}

function SearchBar({
    users,
    participants,
    onClose,
}: {
    users: User[];
    participants: Participant[];
    onClose: (arg: User | null) => void;
}) {
    const [value, setValue] = useState("");
    const [suggestions, setSuggestions] = useState<User[]>(users);
    const [hideSuggestions, setHideSuggestions] = useState(true);
    const [result, setResult] = useState<User | null>(null);

    useEffect(() => {

        const updateSuggestions = async () => {
            try {
                const data = users.filter((user) => 
                    user.id.toLowerCase().startsWith(value.toLowerCase()) 
                    || user.firstName.toLowerCase().startsWith(value.toLowerCase())
                    || user.surname.toLowerCase().startsWith(value.toLowerCase()));
                setSuggestions(data);
            } catch (error) {
                console.log(error);
            }
        };

        updateSuggestions();
    }, [value]);

    return (
        <>
            {!result ? (
                <div className="text-black">
                    <input
                        onFocus={() => setHideSuggestions(false)}
                        onBlur={async () => {
                            setTimeout(() => {
                            setHideSuggestions(true);
                            }, 200);
                        }}
                        type="text"
                        className="w-full border border-solid border-[#f3f3f3] box-border p-px focus:border-blue-500"
                        placeholder="Search user..."
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value);
                        }}
                    />
                    {!hideSuggestions && (
                        <div
                            className={`overflow-y-scroll border border-solid border-[#f3f3f3] bg-white max-h-28 h-fit z-10`}
                        >
                            {suggestions.map((suggestion) => (
                                <div
                                    key={suggestion.id}
                                    className="flex flex-col items-start cursor-pointer box-border p-1 hover:bg-[#f3f3f3]"
                                    onClick={() => setResult(suggestion)}
                                >
                                    <div>
                                        {suggestion.surname} {suggestion.firstName}
                                    </div>
                                    <div className="ml-2">
                                        id: {suggestion.id}
                                    </div>
                                    <div className="ml-2">
                                        member: {suggestion.isMember ? "yes" : "no"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <div className="bg-[#f8fbfc] text-black text-left px-2 pb-2">
                        <div className="flex justify-between">
                            <div className="mt-2">
                                {result.surname} {result.firstName}
                            </div>
                            <button onClick={() => setResult(null)} className="">
                                X
                            </button>
                        </div>
                        <div className="ml-2">
                            id: {result.id}
                        </div>
                        <div className="ml-2">
                            member: {result.isMember ? "yes" : "no"}
                        </div>
                    </div>

                    {participants.every(participant => participant.id !== result.id) ? (
                        <button onClick={() => onClose(result)} className="mt-5 text-[#1e7b97] bg-[#ecf7fb] px-2 py-1 rounded-md">
                            Add user
                        </button>
                    ) : (
                        <div className="mt-5">
                            Already a participant!
                        </div>
                    )}
                </div>
            )}
        </>
    )
}