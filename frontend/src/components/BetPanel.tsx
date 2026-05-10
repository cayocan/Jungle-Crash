import { useState, useEffect, type ChangeEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useGameStore } from "../store/gameStore";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Timer, TrendingUp, DollarSign, Zap } from "lucide-react";
import "./BetPanel.css";

const API = "/games";

interface Props {
    userId?: string;
}

export default function BetPanel({ userId }: Props) {
    const { getToken } = useAuth();
    const { status, multiplier, bettingEndsAt, hasBet, hasCashedOut } =
        useGameStore();
    const queryClient = useQueryClient();

    const [amountInput, setAmountInput] = useState("1000");
    const [autoCashoutInput, setAutoCashoutInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Countdown timer
    useEffect(() => {
        if (!bettingEndsAt) {
            setCountdown(0);
            return;
        }
        const tick = () =>
            setCountdown(Math.max(0, Math.ceil((bettingEndsAt - Date.now()) / 1000)));
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [bettingEndsAt]);

    const amountCents = Math.round(parseFloat(amountInput || "0") * 100);
    const canBet =
        status === "betting" &&
        !hasBet &&
        amountCents >= 100 &&
        amountCents <= 100_000;
    const canCashout = status === "running" && hasBet && !hasCashedOut;
    const potentialPayout =
        hasBet && status === "running" ? (amountCents * multiplier) / 100 : null;

    async function placeBet() {
        if (!canBet) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/bet`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${getToken()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    amountCents,
                    ...(autoCashoutInput ? { autoCashoutAt: parseFloat(autoCashoutInput) } : {}),
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as Record<string, unknown>;
                toast.error((body?.message as string) ?? "Erro ao apostar");
            } else {
                toast.success(
                    `Aposta de R$ ${(amountCents / 100).toFixed(2)} enviada!`,
                );
            }
        } catch {
            toast.error("Erro de conexão");
        } finally {
            setLoading(false);
        }
    }

    async function cashout() {
        if (!canCashout) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/bet/cashout`, {
                method: "POST",
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as Record<string, unknown>;
                toast.error((body?.message as string) ?? "Erro ao fazer cashout");
            } else {
                queryClient.invalidateQueries({ queryKey: ["wallet"] });
            }
        } catch {
            toast.error("Erro de conexão");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="card space-y-4">
            {/* Title + countdown */}
            <div className="flex items-center justify-between">
                <h2 className="section-title">
                    Apostar
                </h2>
                {status === "betting" && countdown > 0 && (
                    <div className="bet-countdown">
                        <Timer size={14} />
                        <span>{countdown}s</span>
                    </div>
                )}
            </div>

            {/* Amount input */}
            <div>
                <label className="field-label">
                    Valor da aposta (R$)
                </label>
                <div className="flex gap-2 flex-wrap">
                    {[5, 10, 25, 50].map((v) => (
                        <button
                            key={v}
                            onClick={() => setAmountInput(String(v))}
                            disabled={hasBet || loading}
                            className={`bet-quick-btn${amountInput === String(v) ? " is-selected" : ""}`}
                        >
                            R${v}
                        </button>
                    ))}
                </div>
                <div className="input-wrap mt-2">
                    <DollarSign
                        size={16}
                        className="input-icon"
                    />
                    <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={amountInput}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            const val = e.target.value.replace(",", ".");
                            if (/^\d*\.?\d{0,2}$/.test(val) || val === "")
                                setAmountInput(val);
                        }}
                        disabled={hasBet || loading}
                        className="input-base"
                    />
                </div>
                {amountCents < 100 && amountInput !== "" && (
                    <p className="field-error">
                        Aposta mínima: R$ 1,00
                    </p>
                )}
                {amountCents > 100_000 && (
                    <p className="field-error">
                        Aposta máxima: R$ 1.000,00
                    </p>
                )}
            </div>

            {/* Auto cashout input */}
            <div>
                <label className="field-label">
                    <span className="flex items-center gap-1">
                        <Zap size={11} />
                        Auto cashout em (multiplicador)
                    </span>
                </label>
                <div className={`autocashout-wrap${autoCashoutInput ? " autocashout-wrap--set" : " autocashout-wrap--unset"}`}>
                    <span className="autocashout-mul">×</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex: 2.00 (opcional)"
                        value={autoCashoutInput}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            const val = e.target.value.replace(",", ".");
                            if (/^\d*\.?\d{0,2}$/.test(val) || val === "") setAutoCashoutInput(val);
                        }}
                        disabled={hasBet || loading}
                        className="input-base"
                    />
                    {autoCashoutInput && (
                        <button
                            onClick={() => setAutoCashoutInput("")}
                            className="autocashout-clear mr-2 text-xs"
                        >✕</button>
                    )}
                </div>
                {autoCashoutInput && parseFloat(autoCashoutInput) < 1.01 && (
                    <p className="field-error">Mínimo: ×1.01</p>
                )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
                <button
                    onClick={placeBet}
                    disabled={!canBet || loading}
                    className={`bet-btn${canBet ? " is-active" : ""}`}
                >
                    {loading && canBet ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="anim-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                            Apostando…
                        </span>
                    ) : status === "betting" ? (
                        "🎲 Apostar"
                    ) : hasBet ? (
                        "✅ Apostado"
                    ) : (
                        "Aguardando…"
                    )}
                </button>

                <button
                    onClick={cashout}
                    disabled={!canCashout || loading}
                    className={`cashout-btn${canCashout ? " is-active" : ""}`}
                >
                    {loading && canCashout ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="anim-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                            …
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-1.5">
                            <TrendingUp size={14} />
                            {canCashout && potentialPayout != null
                                ? `Cashout R$ ${potentialPayout.toFixed(2)}`
                                : "Cash Out"}
                        </span>
                    )}
                    {/* Status message */}
                    {status === "crashed" && hasBet && !hasCashedOut && (
                        <p className="text-xs text-center field-error">
                            💸 Aposta perdida nesta rodada
                        </p>
                    )}
                    {status === "crashed" && hasCashedOut && (
                        <p className="text-xs text-center text-success">
                            💰 Cashout realizado com sucesso!
                        </p>
                    )}</button>
            </div>
        </div>
    );
}

