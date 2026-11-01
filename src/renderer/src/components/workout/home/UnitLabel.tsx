export function UnitLabel({ unit }: { unit: string }) {
  return unit ? <span className="ml-1.5 text-[11.5px] font-normal text-faint">{unit}</span> : null
}
