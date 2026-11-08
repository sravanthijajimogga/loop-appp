"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type PrinterStage = "processing" | "printing" | "complete";
export type FeedMotion = "smooth" | "stepped";

type ReceiptPrinterProps = {
  seats: string[];
  total: number;
  unitPrice: number;
  flightCode: string;
  airline: string;
  fromCity: string;
  toCity: string;
  bulk?: boolean;
  autoStart?: boolean;
  feedMotion?: FeedMotion;
  className?: string;
};

const printingTransformKeyframes = {
  smooth: [0, 1],
  stepped: [0, 0.18, 0.18, 0.36, 0.36, 0.54, 0.54, 0.72, 0.72, 0.9, 0.9, 1],
};

const tooth =
  "polygon(0 0,100% 0,100% calc(100% - 12px),96.4% 100%,92.8% calc(100% - 12px),89.2% 100%,85.6% calc(100% - 12px),82% 100%,78.4% calc(100% - 12px),74.8% 100%,71.2% calc(100% - 12px),67.6% 100%,64% calc(100% - 12px),60.4% 100%,56.8% calc(100% - 12px),53.2% 100%,49.6% calc(100% - 12px),46% 100%,42.4% calc(100% - 12px),38.8% 100%,35.2% calc(100% - 12px),31.6% 100%,28% calc(100% - 12px),24.4% 100%,20.8% calc(100% - 12px),17.2% 100%,13.6% calc(100% - 12px),10% 100%,6.4% calc(100% - 12px),2.8% 100%,0 calc(100% - 12px))";

export function ReceiptPrinter({
  seats,
  total,
  unitPrice,
  flightCode,
  airline,
  fromCity,
  toCity,
  bulk = false,
  autoStart = true,
  feedMotion = "stepped",
  className,
}: ReceiptPrinterProps) {
  const [stage, setStage] = useState<PrinterStage>(
    autoStart ? "processing" : "complete",
  );

  useEffect(() => {
    if (!autoStart) {
      return;
    }
    const printingTimer = window.setTimeout(() => setStage("printing"), 1100);
    const completeTimer = window.setTimeout(() => setStage("complete"), 3400);
    return () => {
      window.clearTimeout(printingTimer);
      window.clearTimeout(completeTimer);
    };
  }, [autoStart]);

  const feed = useMemo(
    () => printingTransformKeyframes[feedMotion],
    [feedMotion],
  );

  const paperOpen = stage !== "processing";

  return (
    <ReceiptPrinter.Root className={className}>
      <ReceiptPrinter.Machine>
        <ReceiptPrinter.Header airline={airline} />
        <ReceiptPrinter.Screen stage={stage} />
        <ReceiptPrinter.Output>
          <ReceiptPrinter.Paper
            open={paperOpen}
            complete={stage === "complete"}
            feed={feed}
          >
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">
              Boarding pass
            </p>
            <p className="mt-1 font-serif text-lg text-slate-900">
              {fromCity} → {toCity}
            </p>
            <p className="text-xs text-slate-500">
              {flightCode} · {airline}
            </p>
            <div className="my-3 h-px border-t border-dashed border-slate-300" />
            <p className="text-xs text-slate-600">Seats</p>
            <p className="font-mono text-base font-semibold tracking-wide text-slate-900">
              {seats.length ? seats.join("  ·  ") : "—"}
            </p>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-600">
                  {bulk ? "Bulk fare" : "Fare"}
                </p>
                <p className="text-xs text-slate-500">₹{unitPrice} each</p>
              </div>
              <p className="font-serif text-2xl text-slate-900">₹{total}</p>
            </div>
          </ReceiptPrinter.Paper>
        </ReceiptPrinter.Output>
        <ReceiptPrinter.Status stage={stage} />
      </ReceiptPrinter.Machine>
    </ReceiptPrinter.Root>
  );
}

function Root({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex w-full flex-col items-center px-4", className)}>
      {children}
    </div>
  );
}

function Machine({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-slate-300 p-4 shadow-[0_24px_50px_rgba(15,23,42,0.18)]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(248,250,252,0.92), rgba(203,213,225,0.92)), url(/textures/brushed-metal.svg)",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-x-8 top-2 h-1.5 rounded-full bg-slate-400/70" />
      <div className="absolute right-5 top-5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
      {children}
    </div>
  );
}

function Header({ airline }: { airline: string }) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-900/90 px-4 py-3 text-slate-50">
      <p className="font-serif text-lg tracking-wide">Loop</p>
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">
        {airline}
      </p>
    </div>
  );
}

function Screen({ stage }: { stage: PrinterStage }) {
  const label =
    stage === "processing"
      ? "Authorizing fare…"
      : stage === "printing"
        ? "Printing ticket…"
        : "Ticket ready";

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-700 bg-[#0f172a] px-3 py-2 font-mono text-xs text-emerald-300">
      {stage === "complete" ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      )}
      {label}
    </div>
  );
}

function Output({ children }: { children: ReactNode }) {
  return (
    <div className="relative mt-4 overflow-hidden rounded-b-lg">
      <div className="h-3 rounded-sm bg-gradient-to-b from-slate-700 to-slate-900 shadow-inner" />
      <div className="flex justify-center bg-gradient-to-b from-slate-800 to-transparent px-6 pb-2 pt-1">
        {children}
      </div>
    </div>
  );
}

function Paper({
  open,
  complete,
  feed,
  children,
}: {
  open: boolean;
  complete: boolean;
  feed: number[];
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ height: 0, y: -12, opacity: 0.4 }}
      animate={
        open
          ? { height: complete ? 300 : 220, y: 0, opacity: 1 }
          : { height: 0, y: -12, opacity: 0.4 }
      }
      transition={{
        duration: open ? 1.8 : 0.3,
        ease: "easeInOut",
        times: feed,
      }}
      className="w-full overflow-hidden bg-[#f6f1e4] text-slate-900 shadow-lg"
      style={{
        clipPath: tooth,
        backgroundImage: "url(/textures/paper-grain.svg)",
      }}
    >
      <div className="px-5 pb-8 pt-4">{children}</div>
    </motion.div>
  );
}

function Status({ stage }: { stage: PrinterStage }) {
  return (
    <p className="mt-3 text-center text-xs uppercase tracking-[0.22em] text-slate-600">
      {stage === "processing" && "Processing"}
      {stage === "printing" && "Printing"}
      {stage === "complete" && "Complete"}
    </p>
  );
}

ReceiptPrinter.Root = Root;
ReceiptPrinter.Machine = Machine;
ReceiptPrinter.Header = Header;
ReceiptPrinter.Screen = Screen;
ReceiptPrinter.Output = Output;
ReceiptPrinter.Paper = Paper;
ReceiptPrinter.Status = Status;
