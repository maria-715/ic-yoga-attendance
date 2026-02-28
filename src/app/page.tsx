"use client"

import { getThisWeekClasses, getPastClasses, GeneralClass, getFutureClasses } from "../../firestore/classes";
import React, { useState, useEffect } from "react";
import { ClassLink } from "@/components/ClassLink";
import { UpdateDatabase } from "@/components/UpdateDatabase";
import { AddClass } from "@/components/AddClass";
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import moment from "moment";

export default function Home() {
  const [weekClasses, setWeekClasses] = useState<GeneralClass[]>([]);
  const [futureClasses, setFutureClasses] = useState<GeneralClass[]>([]);
  const [pastClasses, setPastClasses] = useState<GeneralClass[]>([]);

  useEffect(() => {
    async function getWeekClassesList() {
      const classes = await getThisWeekClasses();
      const sorted = classes.sort((a, b) => 
        new Date(a.time.replace(" ", "T")).getTime() - new Date(b.time.replace(" ", "T")).getTime()
      );
      setWeekClasses(sorted);
    }
    getWeekClassesList();
  }, []);

  useEffect(() => {
    async function getFutureClassesList() {
      const classes = await getFutureClasses();
      const sorted = classes.sort((a, b) => 
        moment(a.time, "DD/MM HH:mm").toDate().getTime() - moment(b.time, "DD/MM HH:mm").toDate().getTime()

      );
      setFutureClasses(sorted);
    }
    getFutureClassesList();
  }, []);


  useEffect(() => {
    async function getPastClassesList() {
      const classes = await getPastClasses();
      const sorted = classes.sort((a, b) => 
        moment(b.time, "DD/MM HH:mm").toDate().getTime() - moment(a.time, "DD/MM HH:mm").toDate().getTime()

      );
      setPastClasses(sorted);
    }
    getPastClassesList();
  }, []);

  return (
    <>
      <div className="bg-[#1e7b97]">
        <div className="py-3 sm:py-3 px-6 flex justify-center">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="flex-1 text-3xl font-sans text-white tracking-tight font-medium select-none cursor-default my-2">
                IC Yoga
              </div>
              <AddClass />
              <UpdateDatabase />
              <div className="">
                <Cog6ToothIcon className="size-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="relative p-6 flex flex-1 flex-col justify-center font-sans font-medium text-xl">
        <p className="pt-10 text-[#1e7b97]">
          This week's classes
        </p>
        <div className="grid gap-4 md:grid-cols-6 py-6">
          {weekClasses.map(yogaClass => (
            <ClassLink href={`/m/${yogaClass.id}`} name={yogaClass.time} key={yogaClass.id} past={false}/>
          ))}
        </div>
        <p className="pt-10 text-[#647e86]">
          Future classes
        </p>
        <div className="grid gap-4 md:grid-cols-6 py-6">
          {futureClasses.map(yogaClass => (
            <ClassLink href={`/m/${yogaClass.id}`} name={yogaClass.time} key={yogaClass.id} past={true}/>
          ))}
        </div>
        <p className="pt-10 text-[#647e86]">
          Past classes
        </p>
        <div className="grid gap-4 md:grid-cols-6 py-6">
          {pastClasses.map(yogaClass => (
            <ClassLink href={`/m/${yogaClass.id}`} name={yogaClass.time} key={yogaClass.id} past={true}/>
          ))}
        </div>
      </div>
    </>
  );
}
