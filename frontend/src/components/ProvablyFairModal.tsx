import { useState, useEffect } from "react";
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
            <button
                onClick={onBack}
                className="flex items-center gap-1 text-xs"
                style={{ color: "#6b7280" }}
            >
                <ChevronLeft size={14} /> Voltar ao histórico
            </button>

            <div className="flex items-center gap-3">
                <span className="text-lg font-black" style={{ color: "#00ff88" }}>
                    Rodada verificada
                </span>
                <span className="text-xs font-mono" style={{ color: "#4a5568" }}>
                    {round.id}
                </span>
            </div>

            {loading && (
                <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: "#4a5568" }}
                >
                    <Loader size={14} className="animate-spin" /> Calculando…
                </div>
            )}

            {result && (
                <div className="flex gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-sm">
                        {result.hashMatch ? (
                            <CheckCircle size={16} style={{ color: "#00ff88" }} />
                        ) : (
                            <XCircle size={16} style={{ color: "#ff3b3b" }} />
                        )}
                        <span style={{ color: result.hashMatch ? "#00ff88" : "#ff3b3b" }}>
                            Compromisso {result.hashMatch ? "válido" : "INVÁLIDO"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        {result.computedCrashPoint === round.crashPoint ? (
                            <CheckCircle size={16} style={{ color: "#00ff88" }} />
                        ) : (
                            <XCircle size={16} style={{ color: "#ff3b3b" }} />
                        )}
                        <span
                            style={{
                                color:
                                    result.computedCrashPoint === round.crashPoint
                                        ? "#00ff88"
                                        : "#ff3b3b",
                            }}
                        >
                            Crash point{" "}
                            {result.computedCrashPoint === round.crashPoint
                                ? "confirmado"
                                : "NÃO CONFERE"}
                        </span>
                    </div>
                </div>
            )}

            <div
                className="rounded-lg p-4 font-mono text-xs overflow-auto"
                style={{
                    background: "#060b14",
                    border: "1px solid #1e2d3d",
                    maxHeight: "340px",
                    color: "#a3b4c6",
                    lineHeight: 1.7,
                }}
            >
                <pre>{JSON.stringify(json, null, 2)}</pre>
            </div>

            <div
                className="rounded-lg p-3 text-xs space-y-1"
                style={{
                    background: "#0a1020",
                    border: "1px solid #1e2d3d",
                    color: "#4a5568",
                }}
            >
                <p className="font-bold" style={{ color: "#6b7280" }}>
                    Como verificar manualmente:
                </p>
                <p>
                    1.{" "}
                    <span style={{ color: "#a3b4c6" }}>
                        HMAC-SHA256(key="public", data=serverSeed)
                    </span>{" "}
                    deve ser igual ao{" "}
                    <span style={{ color: "#a3b4c6" }}>serverSeedHash</span>
                </p>
                <p>
                    2.{" "}
                    <span style={{ color: "#a3b4c6" }}>
                        h = HMAC-SHA256(key=serverSeed, data=salt)
                    </span>
                </p>
                <p>
                    3.{" "}
                    <span style={{ color: "#a3b4c6" }}>
                        n = parseInt(h[0..12], 16) ; e = 2^52
                    </span>
                </p>
                <p>
                    4.{" "}
                    <span style={{ color: "#a3b4c6" }}>
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

    const inputStyle = {
        background: "#060b14",
        border: "1px solid #1e2d3d",
        borderRadius: "0.5rem",
        color: "#f0f0f0",
        padding: "0.5rem 0.75rem",
        fontSize: "0.75rem",
        fontFamily: "monospace",
        width: "100%",
        outline: "none",
    };

    return (
        <div className="space-y-3">
            <p className="text-xs" style={{ color: "#6b7280" }}>
                Insira os dados de uma rodada passada para verificar o crash point de
                forma independente.
            </p>

            {(["serverSeed", "serverSeedHash", "salt"] as const).map((field) => (
                <div key={field}>
                    <label className="block text-xs mb-1" style={{ color: "#4a5568" }}>
                        {field}
                    </label>
                    <input
                        style={inputStyle}
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
                <p className="text-xs" style={{ color: "#ff3b3b" }}>
                    {error}
                </p>
            )}

            <button
                onClick={verify}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
                style={{
                    background: "#00ff88",
                    color: "#050810",
                    border: "none",
                    cursor: loading ? "wait" : "pointer",
                }}
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
                                <CheckCircle size={16} style={{ color: "#00ff88" }} />
                            ) : (
                                <XCircle size={16} style={{ color: "#ff3b3b" }} />
                            )}
                            <span style={{ color: result.hashMatch ? "#00ff88" : "#ff3b3b" }}>
                                Compromisso {result.hashMatch ? "válido" : "INVÁLIDO"}
                            </span>
                        </div>
                    </div>
                    <div
                        className="rounded-lg p-4 font-mono text-xs overflow-auto"
                        style={{
                            background: "#060b14",
                            border: "1px solid #1e2d3d",
                            color: "#a3b4c6",
                            lineHeight: 1.7,
                        }}
                    >
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

    const overlayStyle: React.CSSProperties = {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
    };
    const modalStyle: React.CSSProperties = {
        background: "#0d1421",
        border: "1px solid #1e2d3d",
        borderRadius: "1rem",
        width: "100%",
        maxWidth: "680px",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
    };
    const tabActive = { color: "#00ff88", borderBottom: "2px solid #00ff88" };
    const tabInactive = {
        color: "#4a5568",
        borderBottom: "2px solid transparent",
    };

    return (
        <div
            style={overlayStyle}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div style={modalStyle}>
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0"
                    style={{ borderBottom: "1px solid #1e2d3d" }}
                >
                    <div>
                        <h2 className="font-black text-base" style={{ color: "#f0f0f0" }}>
                            🔐 Provably Fair
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: "#4a5568" }}>
                            Verifique que os crash points são gerados de forma justa e não
                            foram manipulados
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Fechar modal"
                        style={{
                            color: "#4a5568",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div
                    className="flex shrink-0 px-5"
                    style={{ borderBottom: "1px solid #1e2d3d" }}
                >
                    {(["history", "manual"] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => {
                                setTab(t);
                                setSelectedRound(null);
                            }}
                            className="py-3 pr-6 text-xs font-bold transition-colors"
                            style={tab === t ? tabActive : tabInactive}
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
                                        <Loader
                                            size={20}
                                            style={{ color: "#4a5568" }}
                                            className="animate-spin"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <table
                                            style={{
                                                width: "100%",
                                                borderCollapse: "collapse",
                                                fontSize: "0.75rem",
                                            }}
                                        >
                                            <thead>
                                                <tr
                                                    style={{
                                                        color: "#4a5568",
                                                        borderBottom: "1px solid #1e2d3d",
                                                    }}
                                                >
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
                                                            style={{
                                                                borderBottom: "1px solid #0d1421",
                                                                cursor: "pointer",
                                                                background:
                                                                    hoveredId === r.id
                                                                        ? "#0a1320"
                                                                        : "transparent",
                                                            }}
                                                            onMouseEnter={() => setHoveredId(r.id)}
                                                            onMouseLeave={() => setHoveredId(null)}
                                                        >
                                                            <td
                                                                className="py-2 pr-3 font-mono"
                                                                style={{ color: "#6b7280" }}
                                                            >
                                                                {r.id.slice(0, 8)}…
                                                            </td>
                                                            <td
                                                                className="py-2 pr-3 font-bold"
                                                                style={{
                                                                    color: r.crashPoint
                                                                        ? crashColor(r.crashPoint)
                                                                        : "#4a5568",
                                                                }}
                                                            >
                                                                {r.crashPoint
                                                                    ? `${r.crashPoint.toFixed(2)}x`
                                                                    : "—"}
                                                            </td>
                                                            <td
                                                                className="hidden sm:table-cell py-2 pr-3 font-mono"
                                                                style={{ color: "#4a5568" }}
                                                            >
                                                                {truncate(r.serverSeedHash, 20)}
                                                            </td>
                                                            <td
                                                                className="hidden sm:table-cell py-2"
                                                                style={{ color: "#4a5568" }}
                                                            >
                                                                {r.endsAt
                                                                    ? new Date(r.endsAt).toLocaleTimeString(
                                                                        "pt-BR",
                                                                    )
                                                                    : "—"}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>

                                        {/* Pagination */}
                                        <div className="flex items-center justify-between pt-2">
                                            <span className="text-xs" style={{ color: "#4a5568" }}>
                                                {(data as HistoryPage | undefined)?.total ?? 0} rodadas
                                                • página {page}/{totalPages}
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                    disabled={page === 1}
                                                    className="p-1 rounded"
                                                    style={{
                                                        background: "#1e2d3d",
                                                        color: page === 1 ? "#2a3a4d" : "#f0f0f0",
                                                        border: "none",
                                                        cursor: page === 1 ? "default" : "pointer",
                                                    }}
                                                >
                                                    <ChevronLeft size={14} />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setPage((p) => Math.min(totalPages, p + 1))
                                                    }
                                                    disabled={page >= totalPages}
                                                    className="p-1 rounded"
                                                    style={{
                                                        background: "#1e2d3d",
                                                        color: page >= totalPages ? "#2a3a4d" : "#f0f0f0",
                                                        border: "none",
                                                        cursor: page >= totalPages ? "default" : "pointer",
                                                    }}
                                                >
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
