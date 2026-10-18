import { Suspense } from "react";
import { Directorio } from "@/components/directorio/directorio";

export default function ProveedoresPage() {
  return (
    <Suspense>
      <Directorio />
    </Suspense>
  );
}
