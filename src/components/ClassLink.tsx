import Link from "next/link";

export function ClassLink({
  href,
  name,
  past,
}: {
  href: string;
  name: string;
  past: boolean;
}) {
  return (
    <div className="block shadow-lg transition hover:scale-105 hover:shadow-2xl group rounded-3xl max-w-sm max-h-sm ">
      <div className="relative pb-[57.14%]">
        <div className={`rounded-3xl overflow-hidden absolute inset-0 focus-within:ring-4 focus-within:ring-white ${past ? "bg-[#647e86]" : "bg-[#1e7b97]"}`}>
          <Link
            href={href}
            className="absolute inset-0 flex p-4 text-white items-end focus:outline-none"
          >
            <h2 className="font-semibold text-2xl text-shadow-lg [text-wrap:balance]">
              {name}
            </h2>
          </Link>
        </div>
      </div>
    </div>
  );
}
