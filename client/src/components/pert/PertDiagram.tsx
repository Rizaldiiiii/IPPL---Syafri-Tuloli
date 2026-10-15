import { useState } from 'react';
import { Minus, Network, Plus } from 'lucide-react';
import {
  PERT_NODE_HEIGHT,
  PERT_NODE_WIDTH,
  pertNodePosition,
  type PertNodeInput,
  type PertResult,
} from '@gantt/shared';
import { cn } from '../../lib/cn.js';
import { Button } from '../ui/Button.js';
import { EmptyState } from '../ui/Feedback.js';

const SCALES = [0.6, 0.75, 1, 1.25, 1.5];

function nodeCenter(node: PertNodeInput): { x: number; y: number } {
  const position = pertNodePosition(node);
  return { x: position.x + PERT_NODE_WIDTH / 2, y: position.y + PERT_NODE_HEIGHT / 2 };
}

export function PertDiagram({ pert }: { pert: PertResult }): JSX.Element {
  const [scaleIndex, setScaleIndex] = useState(2);

  if (pert.nodes.length === 0) {
    return (
      <EmptyState
        icon={<Network className="h-6 w-6" aria-hidden />}
        title="Diagram PERT belum tersedia"
        description="Tambahkan tugas daun beserta dependensinya untuk melihat jaringan aktivitas."
      />
    );
  }

  const byId = new Map(pert.nodes.map((node) => [node.id, node]));
  const scale = SCALES[scaleIndex];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <p className="text-xs text-ink-3">
          Node merah menandakan aktivitas pada jalur kritis. Geser kanvas untuk menjelajah.
        </p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            aria-label="Perkecil diagram"
            onClick={() => setScaleIndex((index) => Math.max(0, index - 1))}
            disabled={scaleIndex === 0}
            icon={<Minus className="h-3.5 w-3.5" aria-hidden />}
          />
          <span className="tabular w-12 text-center text-xs font-semibold text-ink-2">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="sm"
            variant="secondary"
            aria-label="Perbesar diagram"
            onClick={() => setScaleIndex((index) => Math.min(SCALES.length - 1, index + 1))}
            disabled={scaleIndex === SCALES.length - 1}
            icon={<Plus className="h-3.5 w-3.5" aria-hidden />}
          />
        </div>
      </div>

      <div className="max-h-[520px] overflow-auto bg-surface-2/40 p-3">
        <svg
          width={pert.width * scale}
          height={pert.height * scale}
          viewBox={`0 0 ${pert.width} ${pert.height}`}
          role="img"
          aria-label="Diagram jaringan PERT tugas proyek"
        >
          <defs>
            <marker id="pert-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
            </marker>
            <marker id="pert-arrow-critical" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#B91C1C" />
            </marker>
          </defs>

          {pert.edges.map((edge, index) => {
            const predecessor = byId.get(edge.predecessorId);
            const successor = byId.get(edge.successorId);
            if (!predecessor || !successor) return null;
            const start = pertNodePosition(predecessor);
            const end = pertNodePosition(successor);
            const startX = start.x + PERT_NODE_WIDTH;
            const startY = start.y + PERT_NODE_HEIGHT / 2;
            const endX = end.x;
            const endY = end.y + PERT_NODE_HEIGHT / 2;
            const midX = (startX + endX) / 2;
            return (
              <path
                key={`${edge.predecessorId}-${edge.successorId}-${index}`}
                data-testid={`pert-edge-${edge.predecessorId}-${edge.successorId}`}
                data-critical={edge.critical}
                d={`M ${startX} ${startY} C ${midX} ${startY} ${midX} ${endY} ${endX} ${endY}`}
                fill="none"
                stroke={edge.critical ? '#B91C1C' : '#94A3B8'}
                strokeWidth={edge.critical ? 2 : 1.25}
                markerEnd={`url(#${edge.critical ? 'pert-arrow-critical' : 'pert-arrow'})`}
              />
            );
          })}

          {pert.nodes.map((node) => {
            const position = pertNodePosition(node);
            const center = nodeCenter(node);
            return (
              <g key={node.id} data-testid={`pert-node-${node.id}`} data-critical={node.critical}>
                <rect
                  x={position.x}
                  y={position.y}
                  width={PERT_NODE_WIDTH}
                  height={PERT_NODE_HEIGHT}
                  rx={10}
                  fill={node.critical ? '#FEF2F2' : '#FFFFFF'}
                  stroke={node.critical ? '#B91C1C' : '#CBD5E1'}
                  strokeWidth={node.critical ? 2 : 1}
                />
                <rect
                  x={position.x}
                  y={position.y}
                  width={PERT_NODE_WIDTH}
                  height={26}
                  rx={10}
                  fill={node.critical ? '#B91C1C' : '#334155'}
                />
                <rect
                  x={position.x}
                  y={position.y + 14}
                  width={PERT_NODE_WIDTH}
                  height={12}
                  fill={node.critical ? '#B91C1C' : '#334155'}
                />
                <text x={center.x} y={position.y + 18} textAnchor="middle" fontSize={11} fontWeight={700} fill="#FFFFFF">
                  {node.name.length > 22 ? `${node.name.slice(0, 20)}…` : node.name}
                </text>
                <text x={position.x + 10} y={position.y + 44} fontSize={10} fill="#475569">
                  Durasi
                </text>
                <text x={position.x + PERT_NODE_WIDTH - 10} y={position.y + 44} fontSize={10} fontWeight={700} fill="#0F172A" textAnchor="end">
                  {node.durationDays} hari
                </text>
                <text x={position.x + 10} y={position.y + 60} fontSize={10} fill="#475569">
                  ES / EF
                </text>
                <text x={position.x + PERT_NODE_WIDTH - 10} y={position.y + 60} fontSize={10} fontWeight={700} fill="#0F172A" textAnchor="end">
                  {node.es} / {node.ef}
                </text>
                <text x={position.x + 10} y={position.y + 76} fontSize={10} fill="#475569">
                  LS / LF
                </text>
                <text x={position.x + PERT_NODE_WIDTH - 10} y={position.y + 76} fontSize={10} fontWeight={700} fill="#0F172A" textAnchor="end">
                  {node.ls} / {node.lf}
                </text>
                <text x={position.x + 10} y={position.y + 94} fontSize={10} fill="#475569">
                  Slack
                </text>
                <text
                  x={position.x + PERT_NODE_WIDTH - 10}
                  y={position.y + 94}
                  fontSize={10}
                  fontWeight={700}
                  fill={node.slack === 0 ? '#B91C1C' : '#0F172A'}
                  textAnchor="end"
                >
                  {node.slack}
                </text>
                {node.expectedTime !== null ? (
                  <text x={center.x} y={position.y + PERT_NODE_HEIGHT + 12} textAnchor="middle" fontSize={9} fill="#475569">
                    te = {node.expectedTime.toFixed(2)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      <div className={cn('border-t border-line px-4 py-3 text-xs text-ink-3')}>
        {pert.criticalVariance > 0 ? (
          <p>
            Total variansi jalur kritis <span className="tabular font-semibold text-ink-2">{pert.criticalVariance.toFixed(2)}</span>{' '}
            · simpangan baku{' '}
            <span className="tabular font-semibold text-ink-2">{pert.criticalStandardDeviation.toFixed(2)}</span> hari
          </p>
        ) : (
          <p>Isi estimasi optimistis dan pesimistis pada tugas untuk melihat variansi jalur kritis.</p>
        )}
      </div>
    </div>
  );
}
