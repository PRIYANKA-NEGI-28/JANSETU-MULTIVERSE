import { Filter, RotateCcw, Cpu, Layers } from 'lucide-react';
import { DEPARTMENTS, COMPLAINT_STATUSES, URGENCY_LEVELS } from '@jansetu/shared';
import type { MapFilterState, CivicSource } from './types.js';

export interface MapFiltersProps {
  readonly filters: MapFilterState;
  readonly onChange: (next: MapFilterState) => void;
  readonly onReset: () => void;
  readonly totalMatches: number;
  readonly totalIotNodes: number;
}

export const MUNICIPAL_WARDS = [
  'All Wards',
  'Ghaziabad Ward 1 (Indirapuram)',
  'Ghaziabad Ward 2 (Vaishali)',
  'Ghaziabad Ward 4 (Kaushambi)',
  'Ghaziabad Ward 5 (Raj Nagar Ext)',
  'Ghaziabad Ward 12 (Vasundhara)',
  'Central Delhi Ward 1 (Connaught Place)',
  'Central Delhi Ward 3 (Karol Bagh)',
  'South Delhi Ward 1 (Lajpat Nagar)',
  'South Delhi Ward 6 (Saket)',
  'West Delhi Ward 1 (Dwarka)',
] as const;

export function MapFilters({
  filters,
  onChange,
  onReset,
  totalMatches,
  totalIotNodes,
}: MapFiltersProps) {
  const sources: readonly CivicSource[] = ['ALL', 'MOBILE', 'WEB', 'IOT'];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 space-y-4">
      {/* Top Header & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-orange-500" />
          <span className="font-black text-gray-900 text-xs sm:text-sm tracking-tight">
            Geospatial Intelligence Filters
          </span>
          <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            {totalMatches} Active Clusters
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* IoT Layer Quick Toggle */}
          <button
            type="button"
            onClick={() => onChange({ ...filters, showIotLayer: !filters.showIotLayer })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              filters.showIotLayer
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Cpu size={14} className={filters.showIotLayer ? 'text-emerald-600' : 'text-gray-400'} />
            IoT Grid ({totalIotNodes} Nodes)
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      {/* Filter Select Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Ward Selector */}
        <div>
          <label htmlFor="filter-ward" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Municipal Ward
          </label>
          <select
            id="filter-ward"
            value={filters.ward}
            onChange={(e) => onChange({ ...filters, ward: e.target.value })}
            className="w-full text-xs font-medium bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            {MUNICIPAL_WARDS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        {/* Department Selector */}
        <div>
          <label htmlFor="filter-dept" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Department
          </label>
          <select
            id="filter-dept"
            value={filters.department}
            onChange={(e) =>
              onChange({
                ...filters,
                department: e.target.value as MapFilterState['department'],
              })
            }
            className="w-full text-xs font-medium bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            <option value="ALL">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Status Selector */}
        <div>
          <label htmlFor="filter-status" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(e) =>
              onChange({
                ...filters,
                status: e.target.value as MapFilterState['status'],
              })
            }
            className="w-full text-xs font-medium bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            <option value="ALL">All Statuses</option>
            {COMPLAINT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Urgency Selector */}
        <div>
          <label htmlFor="filter-urgency" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Urgency / Severity
          </label>
          <select
            id="filter-urgency"
            value={filters.urgency}
            onChange={(e) =>
              onChange({
                ...filters,
                urgency: e.target.value as MapFilterState['urgency'],
              })
            }
            className="w-full text-xs font-medium bg-gray-50/50 border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            <option value="ALL">All Urgencies</option>
            {URGENCY_LEVELS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Channel Source Pill Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-2">
            Intake Source:
          </span>
          {sources.map((src) => {
            const isSelected = filters.source === src;
            return (
              <button
                key={src}
                type="button"
                onClick={() => onChange({ ...filters, source: src })}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/30'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {src}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Layers size={13} className="text-gray-400" />
          <span>Spatial clustering: 150m radius</span>
        </div>
      </div>
    </div>
  );
}
