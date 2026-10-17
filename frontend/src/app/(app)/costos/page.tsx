"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Costs, CostByType, OperationRow } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "@/lib/format";
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead, TableCaption } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CostosPage() {
  const [costs, setCosts] = useState<Costs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCosts();
  }, []);

  const fetchCosts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.costs();
      setCosts(data);
    } catch (err) {
      setError("Failed to load costs");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">Cargando...</div>;
  if (error) return <div className="text-center text-destructive py-8">{error}</div>;
  if (!costs) return <div className="text-center py-8">No hay datos de costos</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Costos</h1>
      
      {/* Stat Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile 
          title="Gasto de hoy" 
          value={format.money(costs.today_usd)} 
          icon={<Loader2 className="h-4 w-4 text-muted-foreground" />} 
        />
        <StatTile 
          title="Gasto del mes" 
          value={format.money(costs.month_usd)} 
          icon={<Loader2 className="h-4 w-4 text-muted-foreground" />} 
        />
        <StatTile 
          title="Operaciones" 
          value={costs.operations.toLocaleString()} 
          icon={<Loader2 className="h-4 w-4 text-muted-foreground" />} 
        />
        <StatTile 
          title="Tokens" 
          value={(costs.input_tokens + costs.output_tokens).toLocaleString()} 
          icon={<Loader2 className="h-4 w-4 text-muted-foreground" />} 
        />
      </div>
      
      {/* Cost by Type Table */}
      <Card>
        <CardHeader>
          <CardTitle>Costos por tipo de operación</CardTitle>
          <CardDescription>
            Desglose de costos por tipo de operación realizada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption className="text-sm text-muted-foreground mb-4">
              Costos en USD
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de operación</TableHead>
                <TableHead className="text-center">Operaciones</TableHead>
                <TableHead className="text-center">Total (USD)</TableHead>
                <TableHead className="text-center">Promedio (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.by_type.map((item) => (
                <TableRow key={item.type}>
                  <TableCell>{formatOperationType(item.type)}</TableCell>
                  <TableCell className="text-center">{item.operations}</TableCell>
                  <TableCell className="text-center">
                    {item.total_usd.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.avg_usd.toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Recent Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Operaciones recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {costs.recent.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay operaciones recientes
            </p>
          ) : (
            <Table>
              <TableCaption className="text-sm text-muted-foreground mb-4">
                Últimas operaciones
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Tiempo</TableHead>
                  <TableHead className="text-center">Costo (USD)</TableHead>
                  <TableHead className="text-center">Duración</TableHead>
                  <TableHead className="text-center">Factura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.recent.map((operation) => (
                  <TableRow key={operation.id}>
                    <TableCell>{formatOperationType(operation.type)}</TableCell>
                    <TableCell className="text-center">
                      {new Date(operation.started_at).toLocaleString("es-CO", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-center">
                      {operation.cost.cost_usd.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-center">
                      {operation.cost.duration_ms}ms
                    </TableCell>
                    <TableCell className="text-center">
                      {operation.invoice_id ? (
                        <a
                          href={`/facturas/${operation.invoice_id}`}
                          className="text-sm font-medium underline underline-offset-2 hover:text-primary"
                        >
                          Ver factura
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-background hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatOperationType(type: OperationType): string {
  const map: Record<OperationType, string> = {
    PROCESS_INVOICE: "Procesar factura",
    PROPOSE_RULES: "Proponer reglas",
    CHAT: "Chat",
    RULE_DRAFT: "Redactar regla",
  };
  return map[type] || type;
}