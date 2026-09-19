"use client";

import React, { useState, useEffect } from "react";
import {
  tacticalWorkingMemory,
  WorkingMemoryTelemetry,
  TacticalTaskItem
} from "../../lib/neuro/human/TacticalWorkingMemoryEngine";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { TacIcon } from "../ui/TacIcon";
import { toast } from "../Toast";

export interface WorkingMemoryTaskRibbonProps {
  onOpenDetailedModal?: () => void;
  className?: string;
}

export const WorkingMemoryTaskRibbon: React.FC<WorkingMemoryTaskRibbonProps> = ({
  onOpenDetailedModal,
  className
}) => {
  const [telemetry, setTelemetry] = useState<WorkingMemoryTelemetry>(() =>
    tacticalWorkingMemory.getTelemetry()
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [tasks, setTasks] = useState<TacticalTaskItem[]>(() =>
    tacticalWorkingMemory.getTasks()
  );
  const [newTaskTitle, setNewTaskTitle] = useState("");

  useEffect(() => {
    const unsub = tacticalWorkingMemory.subscribe((telem) => {
      setTelemetry(telem);
      setTasks(tacticalWorkingMemory.getTasks());
    });
    return unsub;
  }, []);

  const handleCompleteActive = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!telemetry.activeTask) return;
    tacticalWorkingMemory.completeTask(telemetry.activeTask.id);
    toast.success(`Objetivo cumplido: ${telemetry.activeTask.title}`);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    tacticalWorkingMemory.addTask(newTaskTitle.trim(), "Directiva táctica manual", "MANUAL_TOUCH");
    setNewTaskTitle("");
    TacticalAudioEngine.playRogerBeep();
    toast.info("Nueva directiva agregada a la memoria de trabajo");
  };

  const handleReset = () => {
    tacticalWorkingMemory.resetAllTasks();
    TacticalAudioEngine.playAlert();
    toast.info("Secuencia de tareas restablecida");
  };

  const activeTask = telemetry.activeTask;

  return (
    <div
      className={className}
      style={{
        width: '100%',
        background: '#070B14',
        borderBottom: '1px solid #1E293B',
        fontFamily: 'monospace',
        userSelect: 'none',
        zIndex: 1000
      }}
    >
      {/* Cinta Principal Compacta */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          cursor: 'pointer',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <div style={{ color: activeTask ? '#10B981' : '#64748B', display: 'flex' }}>
            <TacIcon name="check-double" size={16} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 'bold' }}>
              DLPFC [{telemetry.completedTasksCount}/{telemetry.totalTasks}]
            </span>

            <span style={{
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: activeTask ? '#F8FAFC' : '#94A3B8',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {activeTask ? activeTask.title : "¡MISIÓN TÁCTICA CUMPLIDA!"}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Barra de progreso visual */}
          <div style={{ width: '50px', height: '4px', background: '#1E293B', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${telemetry.overallProgressPct}%`, height: '100%', background: '#10B981' }} />
          </div>

          {activeTask && (
            <button
              onClick={handleCompleteActive}
              title="Marcar completado y avanzar"
              style={{
                background: '#065F46',
                border: '1px solid #10B981',
                borderRadius: '4px',
                color: '#ECFDF5',
                padding: '3px 8px',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <TacIcon name="check" size={12} />
              CUMPLIR
            </button>
          )}

          <div style={{ color: '#64748B', fontSize: '0.70rem' }}>
            {isExpanded ? '▲' : '▼'}
          </div>
        </div>
      </div>

      {/* Despliegue Expandido de Tareas */}
      {isExpanded && (
        <div
          style={{
            padding: '10px 12px',
            background: '#05070D',
            borderTop: '1px solid #1E293B',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', color: '#64748B' }}>
              COLA SECUENCIAL DE MEMORIA DE TRABAJO EJECUTIVA (7±2)
            </span>
            <button
              onClick={handleReset}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '0.65rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Reiniciar cola
            </button>
          </div>

          {/* Lista de tareas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
            {tasks.map((t, idx) => (
              <div
                key={t.id}
                onClick={() => !t.isCompleted && tacticalWorkingMemory.completeTask(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  background: t.isCompleted ? '#090D16' : t.id === activeTask?.id ? '#1E293B' : '#0F172A',
                  borderRadius: '4px',
                  fontSize: '0.70rem',
                  borderLeft: `3px solid ${t.isCompleted ? '#10B981' : t.id === activeTask?.id ? '#38BDF8' : '#334155'}`,
                  cursor: t.isCompleted ? 'default' : 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: t.isCompleted ? '#10B981' : '#64748B', fontWeight: 'bold' }}>
                    #{idx + 1}
                  </span>
                  <span style={{
                    color: t.isCompleted ? '#64748B' : '#F8FAFC',
                    textDecoration: t.isCompleted ? 'line-through' : 'none',
                    fontWeight: t.id === activeTask?.id ? 'bold' : 'normal'
                  }}>
                    {t.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.60rem', color: '#64748B' }}>
                    [{t.triggerType}]
                  </span>
                  {t.isCompleted && (
                    <span style={{ color: '#10B981', fontSize: '0.65rem' }}>✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Formulario rápido para agregar paso táctico */}
          <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <input
              type="text"
              placeholder="Nueva directiva ejecutiva..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              style={{
                flex: 1,
                background: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '4px',
                padding: '4px 8px',
                color: '#F8FAFC',
                fontSize: '0.70rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                background: '#1E293B',
                border: '1px solid #475569',
                borderRadius: '4px',
                color: '#E2E8F0',
                padding: '4px 10px',
                fontSize: '0.70rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              + AÑADIR
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
