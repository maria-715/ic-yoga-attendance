"use client";

import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Class, getClassInformation } from "../../../../firestore/classes";
import { Participant } from "../../../../firestore/participants";
import { AddParticipantModal } from "@/components/AddParticipantModal";
import { User, getAllUsers, getUserInformation } from "../../../../firestore/users";
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import { UpdateDatabase } from "@/components/UpdateDatabase";


const NO_TICKET_MESSAGE = "No ticket";


export default function Page() {

    const params = useParams();
    const id = params?.id as string;

    const [users, setUsers] = useState<User[]>([]);
    const [isAddParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
    const [classInfos, setClassInfos] = useState<Class>(new Class("", "", [], [], ""));
    const [classTickets, setClassTickets] = useState<Map<string, string>>(new Map());
    const [notes, setNotes] = useState(classInfos.notes ?? "");


    useEffect(() => {
      async function getUsers() {
        const users = await getAllUsers();
        if (users != null) {
          setUsers(users);
        }
      }
      getUsers();
    }, []);
    

    useEffect(() => {
      async function getClassInfos() {
        const informations = await getClassInformation(id);
        if (informations != null) {
          setClassInfos(informations);
        }
      }
      getClassInfos();
    }, []);


    useEffect(() => {
      setNotes(classInfos.notes ?? "");
    }, [classInfos.notes]); // Careful, I changed last minute classInfos to classInfos.notes


    // Logic for auto-saving notes
    useEffect(() => {
      const timeout = setTimeout(() => {
        const saveNotes = async () => {
          if (notes !== classInfos.notes) {
            try {
              const updatedClassInfos = await classInfos.updateNotesStatus(notes);
              setClassInfos(updatedClassInfos);
            } catch (error) {
              throw new Error(`Error while updating the notes.\n${error}`);
            }
          }
        };

        saveNotes();
      }, 1000); // Auto-save if the coordinator doesn't write anything in the next second

      return () => clearTimeout(timeout);
    }, [notes]);


    // Note: not super efficient because have to refetch everything again
    useEffect(() => {
      async function fetchClassTickets() {
        const newClassTickets = new Map<string, string>();
    
        await Promise.all(
          classInfos.participants.map(async (participant) => {
            const classTicket = await participant.user.getCurrentTicket(classInfos.id, classInfos.validTickets);
            
            newClassTickets.set(
              participant.user.id,
              classTicket ? `${classTicket.classes?.length}/${classTicket.numTotal}` : NO_TICKET_MESSAGE
            );
          })
        );
    
        setClassTickets(newClassTickets);
      }
    
      if (classInfos.participants.length > 0) {
        fetchClassTickets();
      }
    }, [classInfos.participants]);


    // When checking "Attended"
    const handleChangedAttended = async (participant: Participant, attended: boolean) => {

      try {

        const updatedClassInfos = await classInfos.updateAttendedStatus(participant, attended);
        setClassInfos(updatedClassInfos);

      } catch (error) {
        throw new Error(`Error when changing attended status.\n${error}`);
      }
      
    }


    // When checking "Forgot Class Pass"
    const handleChangedHasClassPass = async (participant: Participant, missingClassPass: boolean) => {

      try {

        const updatedClassInfos = await classInfos.updateHasClassPassStatus(participant, missingClassPass);
        setClassInfos(updatedClassInfos);

      } catch (error) {
        throw new Error(`Error when changing missing class pass status.\n${error}`);
      }
      
    }


    // When clicking "Save"
    const saveAsCSV = () => {

      const header = [
        "Participant Login",
        "Participant Name",
        "Attended"
      ]

      // Prepare CSV file
      const rows = classInfos.participants.map((participant) => [
        participant.user.id,
        `${participant.user.surname} ${participant.user.firstName}`,
        participant.attended ? "True" : "False",
      ]);

      // Combine header and rows
      const csvContent = [header, ...rows];

      const csvString = csvContent.map((row) => row.join(",")).join("\n");

      // Create a downloadable file
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob); // Temporary URL that points to a memory-based object
    
      // Create a link to download the file
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${classInfos.time.replace(/[/:]/g, '-').replace(/[ ]/g, '_')}_Attendances.csv`);

      // Append the link to the DOM, click it to start the download, and remove it afterward
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    }


    function openModal() {
      setIsParticipantModalOpen(true);
    }

    
    async function closeModal(user: User | null) {
      setIsParticipantModalOpen(false);

      if (user) {
        try {
          const updatedClassInfos = await classInfos.addParticipant(user);
          setClassInfos(updatedClassInfos);
          
        } catch (error) {
          throw new Error(`Error while updating the participants.\n${error}`);
        }
      }
    }


    return (
      <>
        <div className="bg-[#1e7b97]">
          <div className="py-3 sm:py-3 px-6 flex justify-center">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <div className="flex-1 text-3xl font-sans text-white tracking-tight font-medium select-none cursor-default my-2">
                IC Yoga
                </div>
                <UpdateDatabase />
                <div className="">
                  <Cog6ToothIcon className="size-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative p-6 flex flex-col justify-center items-center font-sans text-[#1e7b97]">
          <div className="flex flex-row items-center w-full font-medium mb-6">
            <Link href="/" className="text-white px-3 p-3 rounded-2xl bg-[#1e7b97] flex flex-row items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-6 sm:h-6 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75 3 12m0 0 3.75-3.75M3 12h18" />
              </svg>
              Back
            </Link>
            <h1 className="text-2xl tracking-tight mt-4 w-full text-center">{classInfos.time}</h1>
            <button onClick={saveAsCSV} className="text-white px-3 p-3 rounded-2xl bg-[#1e7b97] flex flex-row items-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 sm:w-6 sm:h-6 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Save
            </button>
          </div>

          <div className="w-full">
            <textarea
              className="w-full border border-[#1e7b97] rounded-md p-2 text-gray-700 mt-2 mb-2 !text-[#1e7b97]"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write notes..."
            />
          </div>
          
          
          <div>
            <table className="table-fixed w-full border-collapse">
              <thead className="border-b border-[#1e7b97]">
                <tr className="tracking-wider">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Attended</th>
                  <th className="pb-3">Valid ticket</th>
                  <th className="pb-3">Forgot class pass</th>
                </tr>
              </thead>
              <tbody>
                {classInfos.participants.map((participant, index) => {

                  const isEven = index % 2 === 0;
                  const bgColor = isEven ? "bg-[#d2e9ef]" : "bg-[#e5f2f6]";
                  const nbMissingTicks = participant.user.getTotalNbMissingTicksOnPasses();

                  return (
                    <React.Fragment key={participant.user.id}>
                      <tr className={bgColor}>
                        <td>
                          <div
                            className={`p-1 text-center ${
                              classTickets.get(participant.user.id) === NO_TICKET_MESSAGE || classTickets.get(participant.user.id) === undefined
                                ? "text-[#e9668a] font-bold"
                                : ""
                            }`}
                          >
                            {participant.user.surname} {participant.user.firstName}
                          </div>
                        </td>
                        <td>
                          <div className="p-1 flex justify-center items-center">
                            <input 
                              type="checkbox"
                              checked={participant.attended}
                              disabled={participant.missingClassPass || classTickets.get(participant.user.id) === NO_TICKET_MESSAGE || classTickets.get(participant.user.id) === undefined }
                              onChange={(e) => handleChangedAttended(participant, e.target.checked)} 
                            />
                          </div>
                        </td>
                        <td className="text-center">
                          { 
                            classTickets.get(participant.user.id) ?? "Loading..."
                          }
                        </td>
                        <td>
                          <div className="p-1 flex justify-center items-center">
                            { // Only show the checkbox if the valid ticket of the user is a 10-class pass
                              // (of format nn/10)
                            
                            /^(\d{1,2})\/10$/.test(classTickets.get(participant.user.id) ?? "") ? (
                              <input 
                                type="checkbox"
                                checked={participant.missingClassPass}
                                disabled={!participant.attended} 
                                onChange={(e) => handleChangedHasClassPass(participant, e.target.checked)} 
                              />
                            ) : <></> }
                          </div>
                        </td>
                      </tr>
                      
                      {(nbMissingTicks > 0) && (
                        <tr className={bgColor}>
                          <td colSpan={4} className="text-center p-2 text-[#e9668a] font-semibold">
                            → Do {nbMissingTicks} extra tick
                            {nbMissingTicks > 1 ? "s" : ""} on class pass
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
              })}
              </tbody>
            </table>
          </div>

          <div className="pb-3 pt-2 flex flex-col w-full">
            <button onClick={openModal} className="px-3 p-2 bg-[#cddce0] flex flex-row items-center">
              + Add participant
            </button>
          </div>
          
          <div className="p-2 flex flex-col md:gap-6 lg:gap-6 sm:flex-row">
            <p>Number enrolments: {classInfos.participants.length}</p>
            <p>Number attendances: {classInfos.participants.filter(p => p.attended).length}</p>
          </div>

        </div> 

        <AddParticipantModal isOpen={isAddParticipantModalOpen} onClose={closeModal} users={users} participants={classInfos.participants} />
      </>
    )
}

