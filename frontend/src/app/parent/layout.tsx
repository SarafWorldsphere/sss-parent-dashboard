import Sidebar from "@/components/Sidebar";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
  <div className="w-full min-h-screen overflow-x-hidden bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] font-sans">
  <Sidebar />

  <div className="w-full md:ml-64 md:w-[calc(100%-16rem)] min-w-0 flex flex-col">
    {children}
  </div>
</div>
  );
}
