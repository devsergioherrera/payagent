"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { usePolling } from "@/hooks/use-polling";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { Upload } from "lucide-react";
import Outlet from "@/components/facturas/outlet";
import { InvoiceFilters } from "@/lib/api";

export default function Page() {
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"TODOS" | "PAGADAS" | "ESCALADAS" | "FRENADAS" | "PENDIENTES">("TODOS");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ uploading: boolean; success: boolean; message: string }>({
    uploading: false,
    success: false,
    message: ""
  });

  const { data: invoices, error, refresh } = usePolling(() => api.invoices(filters), 3000);

  const handleUpload = async () => {
    setUploadStatus({ uploading: true, success: false, message: "" });
    try {
      const result = await api.upload(uploadFile, uploadText);
      if (result.invoice_id) {
        setUploadStatus({ uploading: false, success: true, message: "Factura subida exitosamente" });
        setUploadDialogOpen(false);
        // Navigate to the new invoice detail
        // In a real app, we'd use router.push here, but for now we'll refresh
        refresh();
      } else if (result.duplicate_of) {
        setUploadStatus({ uploading: false, success: true, message: "Esta factura ya se había recibido" });
        setUploadDialogOpen(false);
        refresh();
      }
    } catch {
      setUploadStatus({ uploading: false, success: false, message: "Error al subir la factura" });
    }
   };

   return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
        <div className="flex items-center gap-4 mt-4 lg:mt-0">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-10 items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium ring-offset-background hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
              {outcomeFilter === "TODOS" ? "Todas" : outcomeFilter === "PAGADAS" ? "Pagadas" : outcomeFilter === "ESCALADAS" ? "Escaladas" : outcomeFilter === "FRENADAS" ? "Frenadas" : "Pendientes"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </DropdownMenuTrigger>
             <DropdownMenuContent className="w-48">
               <DropdownMenuItem onClick={() => setOutcomeFilter("TODOS")}>Todas</DropdownMenuItem>
               <DropdownMenuItem onClick={() => setOutcomeFilter("PAGADAS")}>Pagadas</DropdownMenuItem>
               <DropdownMenuItem onClick={() => setOutcomeFilter("ESCALADAS")}>Escaladas</DropdownMenuItem>
               <DropdownMenuItem onClick={() => setOutcomeFilter("FRENADAS")}>Frenadas</DropdownMenuItem>
               <DropdownMenuItem onClick={() => setOutcomeFilter("PENDIENTES")}>Pendientes</DropdownMenuItem>
             </DropdownMenuContent>
          </DropdownMenu>
          <Input
            placeholder="Buscar facturas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48"
          />
          <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Subir factura
          </Button>
        </div>
      </div>

       {/* Upload Dialog */}
       <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
         <DialogTrigger>
           <Button>Subir factura</Button>
         </DialogTrigger>
        <DialogContent className="w-96">
          <DialogHeader>
            <DialogTitle>Subir factura</DialogTitle>
            <DialogDescription>
              Arrastra un archivo aquí o haz clic para seleccionar uno. También puedes pegar el texto de la factura.
            </DialogDescription>
          </DialogHeader>
          <DialogContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-xl p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Arrastra PDF, PNG o JPG aquí o haz clic para seleccionar
                </p>
                {/* In a real implementation, we'd have file upload handling here */}
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" />
                <button className="btn btn-ghost mt-2">Seleccionar archivo</button>
              </div>
              <label htmlFor="upload-text" className="text-sm font-medium mb-1 block">
                O pega el texto de la factura
              </label>
              <Textarea
                id="upload-text"
                placeholder="Pega aquí el texto extraído de la factura..."
                value={uploadText}
                onChange={(e) => setUploadText(e.target.value)}
                className="h-24"
              />
              {uploadStatus.uploading && (
                <div className="flex items-center justify-center py-4">
                  <Skeleton className="h-4 w-24" />
                  <span className="ml-2">Subiendo...</span>
                </div>
              )}
              {!uploadStatus.uploading && uploadStatus.message && (
                <div className={`px-4 py-2 rounded-md text-sm ${uploadStatus.success ? "bg-success/20 text-success" : "bg-error/20 text-error"}`}>
                  {uploadStatus.message}
                </div>
              )}
              <Button
                onClick={handleUpload}
                disabled={uploadStatus.uploading}
                className="w-full"
              >
                {uploadStatus.uploading ? "Subiendo..." : "Subir factura"}
              </Button>
            </div>
          </DialogContent>
        </DialogContent>
      </Dialog>

      {/* Invoices List */}
      {error ? (
        <div className="p-6 bg-error/20 rounded-xl text-error">
          Error al cargar las facturas: {(error as Error)?.message}
        </div>
      ) : (
        <Outlet invoices={invoices ?? []} />
      )}

      <Toaster />
    </div>
  );
}

// ChevronDown component (simple placeholder)
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={`h-4 w-4 ${className ?? ""}`}
      strokeWidth={2}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}