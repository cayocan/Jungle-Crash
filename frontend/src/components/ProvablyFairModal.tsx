import { useState, useEffect } from "react";
import './ProvablyFairModal.css';
import {
    X,
    ChevronLeft,
    ChevronRight,
    CheckCircle,
    XCircle,
    Search,
    Loader,
} from "lucide-react";
import {
    useRoundHistory,
    verifyRound,
    type RoundHistoryItem,
    type HistoryPage,
} from "../hooks/useProvablyFair";

interface Props {
    onClose: () => void;
}

type Tab = "history" | "manual";

function crashColor(cp: number) {
    if (cp >= 10) return "#00ff88";
    if (cp >= 3) return "#00cc6a";
    if (cp >= 2) return "#ffd700";
    if (cp >= 1.5) return "#ff8c00";
    return "#ff3b3b";
}

function crashClass(cp: number) {
    if (cp >= 10) return "text-success";
    if (cp >= 3) return "pf-crash-high";
    if (cp >= 2) return "text-gold";
    if (cp >= 1.5) return "pf-crash-mid";
    return "text-crash";
}

function truncate(str: string | undefined, len = 16) {
    if (!str) return "—";
    return str.length > len ? str.slice(0, len) + "…" : str;
}

interface VerifyResult {
    hashMatch: boolean;
    computedHash: string;
    computedCrashPoint: number;
}

function VerificationDetail({
    round,
    onBack,
}: {
    round: RoundHistoryItem;
    onBack: () => void;
}) {
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!round.serverSeed || !round.serverSeedHash || !round.salt) return;
        setLoading(true);
        verifyRound(round.serverSeed, round.serverSeedHash, round.salt)
            .then(setResult)
            .finally(() => setLoading(false));
    }, [round.id]);

    const json = {
        roundId: round.id,
        serverSeedHash: round.serverSeedHash,
        serverSeed: round.serverSeed,
        salt: round.salt,
        crashPoint: round.crashPoint,
        verification: result
            ? {
                commitmentValid: result.hashMatch,
                computedHash: result.computedHash,
                computedCrashPoint: result.computedCrashPoint,
                crashPointMatch: result.computedCrashPoint === round.crashPoint,
            }
            : "computing…",
    };

    return (
        <div className="space-y-4">
            <button onClick={onBack} className="flex items-center gap-1 text-xs text-dim">
                <ChevronLeft size={14} /> Voltar ao histórico
            </button>

            <div className="flex items-center gap-3">
                <span className="text-lg font-black text-success">
                    Rodada verificada
                </span>
                <span className="text-xs font-mono text-muted">
                    {round.id}
                </span>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-sm text-muted">
                    <Loader size={14} className="animate-spin" /> Calculando…
                </div>
            )}

            {result && (
                <div className="flex gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                        {result.hashMatch ? (
                            <CheckCircle size={16} className="text-success" />
                        ) : (
                            <XCircle size={16} className="text-crash" />
                        )}
                        <span className={result.hashMatch ? "text-success" : "text-crash"}>
                            Compromisso {result.hashMatch ? "válido" : "INVÁLIDO"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        {result.computedCrashPoint === round.crashPoint ? (
                            <CheckCircle size={16} className="text-success" />
                        ) : (
                            <XCircle size={16} className="text-crash" />
                        )}
                        <span className={result.computedCrashPoint === round.crashPoint ? "text-success" : "text-crash"}>
                            Crash point{" "}
                            {result.computedCrashPoint === round.crashPoint
                                ? "confirmado"
                                : "NÃO CONFERE"}
                        </span>
                    </div>
                </div>
            )}

            <div className="code-block pf-verify-json">
                <pre>{JSON.stringify(json, null, 2)}</pre>
            </div>

            <div className="pf-info-box text-xs space-y-1">
                <p className="font-bold text-dim">
                    Como verificar manualmente:
                </p>
                <p>
                    1.{" "}
                    <span className="pf-code-inline">
                        HMAC-SHA256(key="public", data=serverSeed)
                    </span>{" "}
                    deve ser igual ao{" "}
                    <span className="pf-code-inline">serverSeedHash</span>
                </p>
                <p>
                    2.{" "}
                    <span className="pf-code-inline">
                        h = HMAC-SHA256(key=serverSeed, data=salt)
                    </span>
                </p>
                <p>
                    3.{" "}
                    <span className="pf-code-inline">
                        n = parseInt(h[0..12], 16) ; e = 2^52
                    </span>
                </p>
                <p>
                    4.{" "}
                    <span className="pf-code-inline">
                        crash = max(1.00, floor((100×e - n) / (e - n)) / 100)
                    </span>
                </p>
            </div>
        </div>
    );
}

function ManualVerify() {
    const [serverSeed, setServerSeed] = useState("");
    const [serverSeedHash, setServerSeedHash] = useState("");
    const [salt, setSalt] = useState("");
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function verify() {
        if (!serverSeed || !serverSeedHash || !salt) {
            setError("Preencha todos os campos.");
            return;
        }
        setError("");
        setLoading(true);
        try {
            const r = await verifyRound(
                serverSeed.trim(),
                serverSeedHash.trim(),
                salt.trim(),
            );
            setResult(r);
        } finally {
            setLoading(false);
        }
    }

    

    return (
        <div className="space-y-3">
            <p className="text-xs text-dim">
                Insira os dados de uma rodada passada para verificar o crash point de
                forma independente.
            </p>

            {(["serverSeed", "serverSeedHash", "salt"] as const).map((field) => (
                <div key={field}>
                    <label className="block text-xs mb-1 text-muted">
                        {field}
                    </label>
                    <input
                        className="pf-input"
                        value={
                            field === "serverSeed"
                                ? serverSeed
                                : field === "serverSeedHash"
                                    ? serverSeedHash
                                    : salt
                        }
                        onChange={(e) => {
                            const v = (e.target as { value: string }).value;
                            if (field === "serverSeed") setServerSeed(v);
                            else if (field === "serverSeedHash") setServerSeedHash(v);
                            else setSalt(v);
                        }}
                        placeholder={field === "salt" ? "e.g. a1b2c3d4" : "hex string…"}
                    />
                </div>
            ))}

            {error && (
                <p className="text-xs text-crash">
                    {error}
                </p>
            )}

            <button
                onClick={verify}
                disabled={loading}
                className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
            >
                {loading ? (
                    <Loader size={14} className="animate-spin" />
                ) : (
                    <Search size={14} />
                )}
                Verificar
            </button>

            {result && (
                <div className="space-y-2">
                    <div className="flex gap-4 flex-wrap">
                        <div className="flex items-center gap-2 text-sm">
                            {result.hashMatch ? (
                                <CheckCircle size={16} className="text-success" />
                            ) : (
                                <XCircle size={16} className="text-crash" />
                            )}
                            <span className={result.hashMatch ? "text-success" : "text-crash"}>
                                Compromisso {result.hashMatch ? "válido" : "INVÁLIDO"}
                            </span>
                        </div>
                    </div>
                    <div className="code-block">
                        <pre>
                            {JSON.stringify(
                                {
                                    hashMatch: result.hashMatch,
                                    computedHash: result.computedHash,
                                    computedCrashPoint: result.computedCrashPoint,
                                },
                                null,
                                2,
                            )}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ProvablyFairModal({ onClose }: Props) {
    const [tab, setTab] = useState<Tab>("history");
    const [page, setPage] = useState(1);
    const limit = 10;
    const [selectedRound, setSelectedRound] = useState<RoundHistoryItem | null>(
        null,
    );
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const { data, isLoading } = useRoundHistory(page, limit);
    const totalPages = data ? Math.ceil((data as HistoryPage).total / limit) : 1;

    return (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal modal--wide">
                {/* Header */}
                <div className="modal__header">
                    <div>
                        <h2 className="font-black text-base">
                            🔐 Provably Fair
                        </h2>
                        <p className="text-xs mt-0.5 text-muted">
                            Verifique que os crash points são gerados de forma justa e não
                            foram manipulados
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Fechar modal" className="modal__close">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="pf-tab-nav">
                    {(["history", "manual"] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setSelectedRound(null); }}
                            className={`pf-tab ${tab === t ? 'is-active' : ''}`}
                        >
                            {t === "history" ? "Histórico de Rodadas" : "Verificação Manual"}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 p-5">
                    {tab === "history" &&
                        (selectedRound ? (
                            <VerificationDetail
                                round={selectedRound}
                                onBack={() => setSelectedRound(null)}
                            />
                        ) : (
                            <div className="space-y-3">
                                {isLoading ? (
                                    <div className="flex justify-center py-10">
                                        <Loader size={20} className="animate-spin text-muted" />
                                    </div>
                                ) : (
                                    <>
                                        <table className="pf-table">
                                            <thead>
                                                <tr>
                                                    <th className="text-left py-2 pr-3">Rodada</th>
                                                    <th className="text-left py-2 pr-3">Crash</th>
                                                    <th className="hidden sm:table-cell text-left py-2 pr-3">
                                                        Hash (prévia)
                                                    </th>
                                                    <th className="hidden sm:table-cell text-left py-2">
                                                        Encerrada em
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {((data as HistoryPage | undefined)?.data ?? []).map(
                                                    (r: RoundHistoryItem) => (
                                                        <tr
                                                            key={r.id}
                                                            onClick={() => setSelectedRound(r)}
                                                            onMouseEnter={() => setHoveredId(r.id)}
                                                            onMouseLeave={() => setHoveredId(null)}
                                                            className="cursor-pointer"
                                                        >
                                                            <td className="py-2 pr-3 font-mono text-dim">
                                                                {r.id.slice(0, 8)}…
                                                            </td>
                                                            <td className={`py-2 pr-3 font-bold ${r.crashPoint ? crashClass(r.crashPoint) : "text-muted"}`}>
                                                                {r.crashPoint ? `${r.crashPoint.toFixed(2)}x` : '—'}
                                                            </td>
                                                            <td className="hidden sm:table-cell py-2 pr-3 font-mono text-muted">
                                                                {truncate(r.serverSeedHash, 20)}
                                                            </td>
                                                            <td className="hidden sm:table-cell py-2 text-muted">
                                                                {r.endsAt ? new Date(r.endsAt).toLocaleTimeString('pt-BR') : '—'}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>

                                        {/* Pagination */}
                                        <div className="flex items-center justify-between pt-2">
                                            <span className="text-xs text-muted">
                                                {(data as HistoryPage | undefined)?.total ?? 0} rodadas
                                                • página {page}/{totalPages}
                                            </span>
                                            <div className="flex gap-2">
                                                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="pf-page-btn">
                                                    <ChevronLeft size={14} />
                                                </button>
                                                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="pf-page-btn">
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}

                    {tab === "manual" && <ManualVerify />}
                </div>
            </div>
        </div>
    );
}
