"use client";

import React, { useState } from "react";

interface PollOption {
    text: string;
    votes: number;
    hasVoted: boolean;
}

interface PollData {
    question: string;
    options: PollOption[];
    totalVotes: number;
}

interface PollBubbleProps {
    poll: PollData;
    isReadonly?: boolean;
}

export function PollBubble({ poll: initialPoll, isReadonly }: PollBubbleProps) {
    const [poll, setPoll] = useState(initialPoll);

    const vote = (idx: number) => {
        if (isReadonly || poll.options[idx].hasVoted || poll.options.some(o => o.hasVoted)) return;
        setPoll(p => ({
            ...p,
            totalVotes: p.totalVotes + 1,
            options: p.options.map((o, i) => i === idx ? { ...o, votes: o.votes + 1, hasVoted: true } : o)
        }));
    };

    const hasVoted = poll.options.some(o => o.hasVoted);
    const maxVotes = Math.max(...poll.options.map(o => o.votes), 1);

    return (
        <div className="poll-bubble glass">
            <div className="poll-header">📊 Encuesta</div>
            <p className="poll-question">{poll.question}</p>
            <div className="poll-options">
                {poll.options.map((opt, i) => {
                    const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                    return (
                        <button key={i} className={`poll-option ${opt.hasVoted ? 'voted' : ''}`} onClick={() => vote(i)} disabled={hasVoted}>
                            <div className="poll-option-bar" style={{ width: hasVoted ? `${pct}%` : "0%" }} />
                            <span className="poll-option-text">{opt.text}</span>
                            {hasVoted && <span className="poll-option-pct">{pct}%</span>}
                            {opt.hasVoted && <span className="poll-check">✓</span>}
                        </button>
                    );
                })}
            </div>
            <p className="poll-votes">{poll.totalVotes} votos</p>
        </div>
    );
}

interface PollComposerProps {
    onSend: (poll: PollData) => void;
    onClose: () => void;
}

export function PollComposer({ onSend, onClose }: PollComposerProps) {
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(["", ""]);

    const addOption = () => options.length < 6 && setOptions([...options, ""]);
    const updateOption = (i: number, v: string) => setOptions(options.map((o, idx) => idx === i ? v : o));
    const removeOption = (i: number) => options.length > 2 && setOptions(options.filter((_, idx) => idx !== i));

    const handleSend = () => {
        const validOpts = options.filter(o => o.trim());
        if (!question.trim() || validOpts.length < 2) return;
        onSend({
            question,
            options: validOpts.map(text => ({ text, votes: 0, hasVoted: false })),
            totalVotes: 0
        });
    };

    return (
        <div className="poll-composer glass animate-fade">
            <div className="poll-composer-header">
                <h3>📊 Nueva Encuesta</h3>
                <button onClick={onClose}>✕</button>
            </div>
            <input className="poll-input" placeholder="Pregunta..." value={question} onChange={e => setQuestion(e.target.value)} />
            {options.map((opt, i) => (
                <div key={i} className="poll-option-input">
                    <input className="poll-input" placeholder={`Opción ${i + 1}`} value={opt} onChange={e => updateOption(i, e.target.value)} />
                    {options.length > 2 && <button onClick={() => removeOption(i)}>✕</button>}
                </div>
            ))}
            {options.length < 6 && <button className="btn-secondary" onClick={addOption}>+ Añadir opción</button>}
            <button className="btn-primary" onClick={handleSend}>Enviar encuesta</button>
        </div>
    );
}
