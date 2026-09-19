import { cn } from '../../lib/utils'
import { CUSTOM_ACCENT_ID, type AccentPreset } from '../../lib/accentColor'
import { BlockColorPicker } from '../ui/BlockColorPicker'

interface AccentColourPickerProps {
  accentId: string
  accentPresets: AccentPreset[]
  customHex: string
  onSelectPreset: (id: string) => void
  onSelectCustom: (hex: string) => void
}

export function AccentColourPicker({
  accentId,
  accentPresets,
  customHex,
  onSelectPreset,
  onSelectCustom,
}: AccentColourPickerProps) {
  return (
    <div className="flex flex-wrap justify-end gap-2.5 max-w-[14rem]">
      {accentPresets.map(preset => {
        const selected = accentId === preset.id
        return (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            aria-label={preset.label}
            aria-pressed={selected}
            onClick={() => onSelectPreset(preset.id)}
            className={cn(
              'h-8 w-8 rounded-full cursor-pointer transition-all attex-focus border-2 border-transparent',
              selected
                ? 'ring-2 ring-offset-2 ring-heading dark:ring-offset-[var(--color-card)] scale-105'
                : 'hover:scale-105 opacity-90 hover:opacity-100',
            )}
            style={{ backgroundColor: preset.accent }}
          />
        )
      })}
      <BlockColorPicker
        value={customHex}
        selected={accentId === CUSTOM_ACCENT_ID}
        aria-label="Pick a custom primary colour"
        onChange={onSelectCustom}
      />
    </div>
  )
}
