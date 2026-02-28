"use client"

import moment from "moment";
import React, { useState, useRef } from "react";
import Link from "next/link";
import { DEFAULT_TICKETS } from "../../global"
import { createClass } from "../../../firestore/classes";
import { Cog6ToothIcon } from '@heroicons/react/24/outline'


export default function AddClassPage() {

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [classTime, setClassTime] = useState("");
  const [validTickets, setValidTickets] = useState<{ productId: number, productLineId: number }[]>(DEFAULT_TICKETS);
  const [validTicketsInput, setValidTicketsInput] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setCsvFile(e.target.files[0]);
    }
  };
  
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClassTime(e.target.value);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotes(e.target.value);
  };

  const handleValidTicketsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setValidTicketsInput(input);

    if (input === "") {
      setValidTickets(DEFAULT_TICKETS);

    } else {

      try {
        const parsed = JSON.parse(input);
        
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (pair) =>
              Array.isArray(pair) &&
              pair.length === 2 &&
              typeof pair[0] === "number" &&
              typeof pair[1] === "number"
          )
        ) {
          const tickets = parsed.map(([productId, productLineId]) => ({
            productId,
            productLineId,
          }));
          setValidTickets(tickets);

        } else {
          throw new Error("Error while changing the valid tickets."); //TODO: verify what to do with errors
        }

      } catch {
        setValidTickets([]);
      }

    }
    
  };


  const isValidDate = (dateString: string) => {
    return moment(dateString, "YYYY-MM-DD HH:mm", true).isValid();
  };


  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();
  
    if (!csvFile || !classTime) {
      alert("Provide both a time and a CSV file.");
      return;
    }

    if (!isValidDate(classTime)) {
      alert("Invalid date format. Format must be YYYY-MM-DD HH:mm");
      return;
    }

    if (validTickets.length === 0) {
      alert("Invalid information about tickets. Format must be [[productID1, productLineID1], [...], ...]");
      return;
    }

    setSubmitting(true)

    try {
      await createClass(classTime, validTickets, notes, csvFile);
      
    } catch (error) {

      throw new Error(`Error while creating a class.\n${error}`);

    } finally {
      setSubmitting(false);
    }

    setSubmitted(true);
    setClassTime("");
    setValidTicketsInput("");
    setNotes("");
    setCsvFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

  };
  
  

  return (
    <>
      <div className="bg-[#1e7b97]">
        <div className="py-3 sm:py-3 px-6 flex justify-center">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="flex-1 text-3xl font-sans text-white tracking-tight font-medium select-none cursor-default my-2">
                IC Yoga
              </div>
              <div className="">
                <Cog6ToothIcon className="size-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative p-6 flex flex-col justify-center items-center font-sans text-[#1e7b97]">
        <div className="flex flex-row items-center w-full font-medium mb-4">
          <Link href="/" className="text-white px-3 p-3 rounded-2xl bg-[#1e7b97] flex flex-row items-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 sm:w-6 sm:h-6 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75 3 12m0 0 3.75-3.75M3 12h18" />
            </svg>
            Back
          </Link>
          <h1 className="absolute left-1/2 transform -translate-x-1/2 ml-4 sm:ml-0 text-2xl tracking-tight w-full text-center pointer-events-none">Add a class</h1>
        </div>

        <p className="mb-4">Submitting an already-existing class (i.e. same date and time) will overwrite the valid products and participants (not the notes).</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="classTime" className="block font-medium mt-2 mb-2">Class Time</label>
            <input
              type="text"
              placeholder="YYYY-MM-DD HH:mm"
              value={classTime}
              onChange={handleTimeChange}
              className="block w-full border border-[#1e7b97] rounded-lg p-2 mt-1 mb-1"
            />
          </div>

          <div>
            <label htmlFor="validTickets" className="block font-medium mt-2 mb-2">ID of products (leave empty for default tickets)</label>
            <input
              type="text"
              placeholder="[[productID1, productLineID1], [...], ...]"
              value={validTicketsInput}
              onChange={handleValidTicketsChange}
              className="block w-full border border-[#1e7b97] rounded-lg p-2 mt-1 mb-1"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block font-medium mt-2 mb-2">Notes</label>
            <input
              type="text"
              placeholder="Add some comment, if useful"
              value={notes}
              onChange={handleNotesChange}
              className="block w-full border border-[#1e7b97] rounded-lg p-2 mt-1 mb-1"
            />
          </div>

          <div>
            <label htmlFor="csvFile" className="block font-medium mt-2 mb-2">CSV of the participants from EActivities</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="block w-full border border-[#1e7b97] rounded-lg cursor-pointer file:py-2 file:px-4 file:mr-2 mt-1 mb-1 file:cursor-pointer file:bg-[#1e7b97] file:border-0 file:text-white "
            />
          </div>

          <div className="flex flex-col items-center">
            <button 
              type="submit"
              disabled={submitting}
              className="bg-[#1e7b97] text-white rounded-xl p-2 mt-2 mb-2 "
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
            {submitted && (<p>Successfully submitted!</p>)}
          </div>
        </form>
      </div>
    </>
  );
}
