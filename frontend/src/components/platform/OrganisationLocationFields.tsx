import { useMemo } from 'react'
import { Select } from '../ui/Select'
import {
  DEFAULT_ORGANISATION_COUNTRY,
  matchOrganisationCityKey,
  organisationCitySelectOptions,
  organisationCountryOptions,
  organisationStateOptions,
  resolveOrganisationCitySelection,
} from '../../lib/organisationLocations'

export interface OrganisationLocationValue {
  city: string
  state: string
  country: string
}

interface Props {
  value: OrganisationLocationValue
  onChange: (next: OrganisationLocationValue) => void
  required?: boolean
}

export function OrganisationLocationFields({ value, onChange, required }: Props) {
  const country = value.country.trim() || DEFAULT_ORGANISATION_COUNTRY
  const state = value.state.trim()
  const city = value.city.trim()

  const countryOptions = useMemo(() => organisationCountryOptions(), [])
  const stateOptions = useMemo(() => organisationStateOptions(country), [country])
  const cityOptions = useMemo(
    () => organisationCitySelectOptions({ country, state: state || undefined }),
    [country, state],
  )

  const citySelectValue = matchOrganisationCityKey(city, state, country)
  const cityDisplayLabel = citySelectValue ? undefined : city || undefined

  const star = required ? ' *' : ''

  return (
    <>
      <Select
        label={`City${star}`}
        placeholder="Search city..."
        searchPlaceholder="Search city or state..."
        options={cityOptions}
        value={citySelectValue}
        displayLabel={cityDisplayLabel}
        onChange={e => {
          const key = e.target.value
          if (!key) {
            onChange({ ...value, city: '' })
            return
          }
          const resolved = resolveOrganisationCitySelection(key)
          onChange({
            city: resolved.city,
            state: resolved.state,
            country: resolved.country,
          })
        }}
      />
      <Select
        label={`State${star}`}
        placeholder="Select state..."
        searchPlaceholder="Search state..."
        options={stateOptions}
        value={state}
        searchable
        onChange={e => {
          const nextState = e.target.value
          const keepCity =
            nextState &&
            city &&
            matchOrganisationCityKey(city, nextState, country) !== ''
          onChange({
            ...value,
            country,
            state: nextState,
            city: keepCity ? city : '',
          })
        }}
      />
      <Select
        label={`Country${star}`}
        placeholder="Select country..."
        options={countryOptions}
        value={country}
        searchable={false}
        onChange={e => {
          const nextCountry = e.target.value || DEFAULT_ORGANISATION_COUNTRY
          const nextStates = organisationStateOptions(nextCountry)
          const stateStillValid = nextStates.some(o => o.value === state)
          onChange({
            city: stateStillValid ? city : '',
            state: stateStillValid ? state : '',
            country: nextCountry,
          })
        }}
      />
    </>
  )
}
