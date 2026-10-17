"use client";

import { useEffect, useState, useRef } from "react";
import { JSX } from "react";
import { api } from "@/lib/api";
import { ChatReply, ChatCard } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Paperclip } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/format";
import { InvoiceSummary } from "@/lib/api-types";
import { VendorView } from "@/lib/api-types";

export function ChatComposer({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Array<{ id: string; text: string; isUser: boolean; cards?: ChatCard[] }>>([]);
  const [inputValue, setInputValue] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const sendMessage = async () => {
    if (!inputValue.trim() && !file) return;

    setIsUploading(true);
    const userMessage = {
      id: (idRef.current++).toString(),
      text: inputValue,
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setFile(null);

    try {
      const response: ChatReply = await api.chat(inputValue, file);
      setIsTyping(true);
      
      // Simulate typing delay
      setTimeout(() => {
         const botMessage = {
           id: (idRef.current++).toString() + "b",
           text: response.text,
           isUser: false,
           cards: response.cards,
         };
        setMessages((prev) => [...prev, botMessage]);
        setIsTyping(false);
        scrollToBottom();
        
        // Handle invoice_id if present
        if (response.invoice_id) {
          // Toast would go here in a real implementation
          console.log("Factura recibida:", response.invoice_id);
        }
      }, 1500);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
         {
           id: (idRef.current++).toString(),
           text: "Error al enviar el mensaje",
           isUser: false,
         }
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isTyping) {
      scrollToBottom();
    }
  }, [isTyping]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className={`${className} flex flex-col h-[200px] max-h-[200px]`}>
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!messages.length && !isUploading ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No hay mensajes aún
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={cn(
                  "flex flex-col gap-1.5",
                  message.isUser ? "mt-4" : "mt-0"
                )}
              >
                {message.isUser ? (
                  <div className="flex justify-end">
                    <div className="max-w-xs rounded-border bg-primary p-3 text-primary-foreground">
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 size-6 rounded-full bg-brand/20 text-brand flex items-center justify-center">
                        •
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="whitespace-pre-wrap">{message.text}</p>
                        {message.cards && message.cards.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.cards.map((card) => renderCard(card))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 size-6 rounded-full bg-brand/20 text-brand flex items-center justify-center">
                  •
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex h-4 items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-brand animate-pulse"></div>
                    <div className="h-1 w-1 rounded-full bg-brand animate-pulse delay-100"></div>
                    <div className="h-1 w-1 rounded-full bg-brand animate-pulse delay-200"></div>
                  </div>
                  <p className="text-sm text-muted-foreground">El agente está escribiendo...</p>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="flex flex-col border-t border-muted-background pt-3">
        <div className="flex items-center gap-2 px-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => document.getElementById("file-input")?.click()}
            className="rounded-full p-1 hover:bg-muted"
            disabled={isUploading}
          >
            <Paperclip className="size-4" />
          </Button>
          <input
            id="file-input"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileChange}
          />
          <Textarea
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
            placeholder="Sube una factura, crea una regla o busca una factura"
            className="flex-1 min-h-[44px] resize-none rounded-border border-input bg-input px-3 py-2 text-sm ring-offset-background file-input:focus-visible:outline-none file-input:focus-visible:ring-2 file-input:focus-visible:ring-ring file-input:focus-visible:ring-offset-0 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isUploading}
          />
          <Button
            onClick={sendMessage}
            className="mt-2 w-full rounded-border bg-brand px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-brand/90 disabled:opacity-50"
            disabled={isUploading || (!inputValue.trim() && !file)}
          >
            {isUploading ? "Enviando..." : "Enviar"}
          </Button>
        </div>

        {/* Suggestion chips */}
        {!isUploading && messages.length === 0 && (
          <div className="flex flex-wrap gap-2 mt-2 px-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInputValue("¿Qué tengo pendiente?");
                sendMessage();
              }}
              className="text-xs"
            >
              ¿Qué tengo pendiente?
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInputValue("Crear una regla");
                sendMessage();
              }}
              className="text-xs"
            >
              Crear una regla
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function renderCard(card: ChatCard): JSX.Element | null {
  switch (card.kind) {
    case "invoice":
      if (!card.invoice) return null;
      const invoice = card.invoice as InvoiceSummary;
      return (
        <div className="border rounded-md p-3">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xs font-medium">
              {invoice.vendor_name ?? "Proveedor desconocido"}
            </span>
            <span className="text-xs text-muted-foreground">
              FV-{invoice.invoice_number ?? "----"}
            </span>
          </div>
          <div className="text-sm font-medium tabular-nums">
            {money(invoice.amount_usd ?? 0, invoice.currency ?? "USD")}
          </div>
          {invoice.outcome && (
            <div className="mt-2 flex items-baseline gap-2">
               <span className="text-xs">
                 {invoice.decided_by === "AGENT" ? "Lo decidió el agente" : "Lo decidiste tú"}
               </span>
               <span className={getOutcomeTextClass(invoice.outcome)}>
                {OUTCOME_LABEL[invoice.outcome]}
              </span>
            </div>
          )}
        </div>
      );
    case "vendor":
      if (!card.vendor) return null;
      const vendor = card.vendor as VendorView;
      return (
        <Card>
          <CardTitle>{vendor.name}</CardTitle>
          <CardDescription>
            ID: {vendor.id} <br />
            {vendor.tax_id} <br />
            {vendor.country} • {vendor.currency}
          </CardDescription>
        </Card>
      );
    case "rule_draft":
      if (!card.rule_draft) return null;
      const rule = card.rule_draft;
      return (
        <Card>
          <CardTitle>{rule.name}</CardTitle>
          <CardDescription>{rule.natural_language}</CardDescription>
          <div className="mt-2 space-y-1 text-xs">
            {rule.conditions.map((condition, index) => (
              <div key={index} className="flex items-baseline gap-1">
                <Badge variant="secondary">{condition.text}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Confirmar regla logic would go here
                console.log("Confirmar regla:", rule.name);
              }}
            >
              Confirmar regla
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Descartar regla logic would go here
                console.log("Descartar regla:", rule.name);
              }}
            >
              Descartar
            </Button>
          </div>
        </Card>
      );
    default:
      return null;
  }
}

function getOutcomeTextClass(outcome: "PAY" | "HOLD" | "ESCALATE" | null): string {
  if (!outcome) return "text-muted-foreground";
  switch (outcome) {
    case "PAY":
      return "text-pay";
    case "HOLD":
      return "text-hold";
    case "ESCALATE":
      return "text-escalate";
    default:
      return "text-muted-foreground";
  }
}

const OUTCOME_LABEL = {
  PAY: "Pagada",
  HOLD: "Frenada",
  ESCALATE: "Escalada",
};