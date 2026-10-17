"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { VendorView } from "@/lib/api-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "@/lib/format";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProveedoresPage() {
  const [vendors, setVendors] = useState<VendorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.vendors();
      setVendors(data);
    } catch (err) {
      setError("Failed to load vendors");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCountryFlag = (country: VendorView["country"]): string => {
    const flags: Record<VendorView["country"], string> = {
      CO: "🇨🇴",
      MX: "🇲🇽",
      BR: "🇧🇷",
      US: "🇺🇸",
    };
    return flags[country] || "";
  };

  const getTaxIdLabel = (country: VendorView["country"]): string => {
    const labels: Record<VendorView["country"], string> = {
      CO: "NIT",
      MX: "RFC",
      BR: "CNPJ",
      US: "EIN",
    };
    return labels[country] || "ID";
  };

  const getStatusBadgeProps = (status: VendorView["status"]) => {
    if (status === "ALLOWED") {
      return {
        variant: "default",
        className: "text-xs",
      } as const;
    } else {
      return {
        variant: "destructive",
        className: "text-xs",
      } as const;
    }
  };

  if (loading) return <div className="text-center py-8">Cargando...</div>;
  if (error) return <div className="text-center text-destructive py-8">{error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
      <div className="space-y-4">
        {vendors.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            isExpanded={expandedVendorId === vendor.id}
            onToggleExpand={() =>
              setExpandedVendorId(
                expandedVendorId === vendor.id ? null : vendor.id
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function VendorCard({
  vendor,
  isExpanded,
  onToggleExpand,
}: {
  vendor: VendorView;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const getCountryFlag = (country: VendorView["country"]): string => {
    const flags: Record<VendorView["country"], string> = {
      CO: "🇨🇴",
      MX: "🇲🇽",
      BR: "🇧🇷",
      US: "🇺🇸",
    };
    return flags[country] || "";
  };

  const getTaxIdLabel = (country: VendorView["country"]): string => {
    const labels: Record<VendorView["country"], string> = {
      CO: "NIT",
      MX: "RFC",
      BR: "CNPJ",
      US: "EIN",
    };
    return labels[country] || "ID";
  };

  const getStatusBadgeProps = (status: VendorView["status"]) => {
    if (status === "ALLOWED") {
      return {
        variant: "default",
        className: "text-xs",
      } as const;
    } else {
      return {
        variant: "destructive",
        className: "text-xs",
      } as const;
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex justify-between items-start p-4">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-semibold tracking-tight">
              {vendor.name}
            </h3>
            <span className="text-xs opacity-60">{getCountryFlag(vendor.country)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {getTaxIdLabel(vendor.country)}: {vendor.tax_id}
          </div>
        </div>
        <button
          onClick={onToggleExpand}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          aria-label={isExpanded ? "Ocultar detalles" : "Mostrar detalles"}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Cuenta bancaria
              </div>
              <div className="font-mono text-sm">{vendor.bank_account}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Medio de pago
              </div>
              <div className="text-sm">{vendor.bank_rail}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Moneda
              </div>
              <div className="text-sm">{vendor.currency}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Estado
              </div>
              <Badge {...getStatusBadgeProps(vendor.status)}>
                {vendor.status === "ALLOWED" ? "Permitido" : "Bloqueado"}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Facturas
              </div>
              <div className="text-sm">{vendor.invoices}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Pagado (USD)
              </div>
              <div className="text-sm font-mono">
                ${vendor.paid_usd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
          
          {/* Purchase Orders */}
          <div>
            <h3 className="text-lg font-medium mb-2">
              Órdenes de compra ({vendor.purchase_orders.length})
            </h3>
            {vendor.purchase_orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay órdenes de compra
              </p>
            ) : (
              <div className="space-y-2">
                {vendor.purchase_orders.map((po) => (
                  <div key={po.po_number} className="border p-3 rounded">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium">
                        PO-{po.po_number}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {po.status === "OPEN" ? "Abierta" : "Cerrada"}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {po.amount} {po.currency}
                    </div>
                    {po.description && (
                      <div className="text-sm mt-1">
                        {po.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

