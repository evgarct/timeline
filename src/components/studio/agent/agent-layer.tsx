"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bot, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { StudioCopy } from "@/i18n/studio-messages";
import { spatial } from "@/lib/motion/tokens";
import { isWebMcpAvailable } from "@/lib/webmcp/model-context";
import { StudioButton, Surface } from "../ds/primitives";
import { agentStore, useAgentState } from "./agent-store";

/**
 * Makes the copilot visible: a chip with its recent actions (and the "save without asking" switch) and the
 * approval dialog for consequential actions. Rendered once by the Studio shell.
 */
export function AgentLayer({ copy }: { copy: StudioCopy }) {
  const state = useAgentState();
  const [open, setOpen] = useState(false);
  const available = useSyncExternalStore(() => () => undefined, isWebMcpAvailable, () => false);

  useEffect(() => { agentStore.hydrate(); }, []);

  const last = state.actions[0];
  const visible = available || state.actions.length > 0;
  const label = (tool: string) => copy.agent.actions[tool] ?? tool;

  return (
    <>
      <AnimatePresence>
        {visible ? (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={spatial.default}
            className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2 lg:bottom-6"
          >
            <AnimatePresence>
              {open ? (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={spatial.fast} className="w-[min(22rem,calc(100vw-2rem))]">
                  <Surface tone="high" className="p-4 shadow-[0_20px_60px_-20px_var(--s-glow)]">
                    <div className="flex items-center justify-between">
                      <div className="s-eyebrow">{copy.agent.history}</div>
                      <button type="button" aria-label={copy.agent.close} onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-full text-[var(--s-on-surface-variant)] outline-none hover:bg-[var(--s-surface-container)] focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]"><X className="size-4" /></button>
                    </div>
                    <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto" aria-live="polite">
                      {state.actions.length ? state.actions.map((action) => (
                        <li key={action.id} className="text-[13px]"><span className="font-semibold">{label(action.tool)}</span>{action.detail ? <span className="text-[var(--s-on-surface-variant)]"> · {action.detail}</span> : null}</li>
                      )) : <li className="text-[13px] text-[var(--s-on-surface-variant)]">{copy.agent.empty}</li>}
                    </ul>
                    <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px]">
                      <input type="checkbox" checked={state.allowSave} onChange={(event) => agentStore.setAllowSave(event.target.checked)} className="size-4 accent-[var(--s-primary)]" />
                      {state.allowSave ? copy.agent.allowSaveOn : copy.agent.allowSaveOff}
                    </label>
                  </Surface>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              transition={spatial.fast}
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              data-testid="agent-chip"
              className="flex h-11 max-w-[min(22rem,calc(100vw-2rem))] items-center gap-2 rounded-full bg-[var(--s-primary)] px-4 text-[13px] font-semibold text-[var(--s-on-primary)] shadow-[0_10px_40px_-10px_var(--s-glow)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--s-background)]"
            >
              <Bot className="size-4 shrink-0" />
              <span className="shrink-0">{copy.agent.chip}</span>
              {last ? <span className="truncate font-normal opacity-80">· {label(last.tool)}</span> : null}
            </motion.button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {state.confirm ? <ConfirmDialog key="confirm" copy={copy} message={state.confirm.message} rememberable={state.confirm.rememberable} /> : null}
      </AnimatePresence>
    </>
  );
}

function ConfirmDialog({ copy, message, rememberable }: { copy: StudioCopy; message: string; rememberable: boolean }) {
  const [remember, setRemember] = useState(false);
  const denyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    denyRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") agentStore.answerConfirm(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="agent-confirm-title"
        aria-describedby="agent-confirm-body"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={spatial.default}
        className="w-full max-w-md rounded-[var(--s-radius-sheet)] bg-[var(--s-surface)] p-6 text-[var(--s-on-background)] shadow-[0_30px_80px_-20px_var(--s-glow)]"
      >
        <div id="agent-confirm-title" className="s-eyebrow">{copy.agent.confirmTitle}</div>
        <p id="agent-confirm-body" className="s-serif mt-3 text-2xl leading-snug">{message}</p>
        {rememberable ? (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] text-[var(--s-on-surface-variant)]">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4 accent-[var(--s-primary)]" />
            {copy.agent.remember}
          </label>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <StudioButton ref={denyRef} variant="tonal" onClick={() => agentStore.answerConfirm(false)}>{copy.agent.deny}</StudioButton>
          <StudioButton onClick={() => agentStore.answerConfirm(true, remember)}>{copy.agent.allow}</StudioButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
