"use client";

// Owned by V6. Replace this placeholder. Client page: the detail polls the API, so read the id with useParams.
import { useParams } from "next/navigation";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <h1 className="text-2xl font-semibold tracking-tight">Factura {id}</h1>;
}
