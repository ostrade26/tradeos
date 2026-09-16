import type { SearchableSelectOption } from '../components/ui/SearchableSelect'

export const DEFAULT_ORGANISATION_COUNTRY = 'India'

/** Supported countries for org address (extend when adding regions). */
export const ORGANISATION_COUNTRIES = [DEFAULT_ORGANISATION_COUNTRY] as const

const CITY_KEY_SEP = '::'

/** Major cities by Indian state / UT — trade-focused wholesale coverage, not exhaustive. */
const CITIES_BY_INDIAN_STATE: Record<string, readonly string[]> = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kakinada', 'Tirupati', 'Rajahmundry'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang'],
  Assam: ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Tezpur', 'Nagaon'],
  Bihar: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga', 'Purnia'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Jagdalpur'],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  Gujarat: [
    'Ahmedabad',
    'Surat',
    'Vadodara',
    'Rajkot',
    'Bhavnagar',
    'Jamnagar',
    'Gandhinagar',
    'Ankleshwar',
    'Bharuch',
    'Kandla',
    'Mundra',
    'Morbi',
    'Junagadh',
  ],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar', 'Rohtak', 'Sonipat'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu', 'Baddi'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Davanagere', 'Ballari', 'Shivamogga'],
  Kerala: ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Alappuzha'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Ratlam', 'Rewa'],
  Maharashtra: [
    'Mumbai',
    'Pune',
    'Nagpur',
    'Nashik',
    'Aurangabad',
    'Thane',
    'Solapur',
    'Kolhapur',
    'Jalgaon',
    'Akola',
    'Navi Mumbai',
  ],
  Manipur: ['Imphal', 'Thoubal', 'Bishnupur'],
  Meghalaya: ['Shillong', 'Tura', 'Jowai'],
  Mizoram: ['Aizawl', 'Lunglei', 'Champhai'],
  Nagaland: ['Kohima', 'Dimapur', 'Mokokchung'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Paradip'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Pathankot'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Alwar', 'Bhilwara', 'Pali'],
  Sikkim: ['Gangtok', 'Namchi', 'Gyalshing'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tiruppur', 'Erode', 'Thoothukudi'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam'],
  Tripura: ['Agartala', 'Udaipur', 'Dharmanagar'],
  'Uttar Pradesh': [
    'Lucknow',
    'Kanpur',
    'Ghaziabad',
    'Noida',
    'Agra',
    'Varanasi',
    'Meerut',
    'Prayagraj',
    'Bareilly',
    'Aligarh',
    'Moradabad',
  ],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol', 'Haldia', 'Kharagpur'],
  'Andaman and Nicobar Islands': ['Port Blair'],
  Chandigarh: ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
  Delhi: ['New Delhi', 'Delhi'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'],
  Ladakh: ['Leh', 'Kargil'],
  Lakshadweep: ['Kavaratti'],
  Puducherry: ['Puducherry', 'Karaikal', 'Yanam'],
}

export const INDIAN_STATES_AND_UTS = Object.keys(CITIES_BY_INDIAN_STATE).sort((a, b) =>
  a.localeCompare(b, 'en', { sensitivity: 'base' }),
)

export function organisationStatesForCountry(country: string): readonly string[] {
  if (country.trim() === DEFAULT_ORGANISATION_COUNTRY) {
    return INDIAN_STATES_AND_UTS
  }
  return []
}

export function organisationCityKey(state: string, city: string): string {
  return `${state}${CITY_KEY_SEP}${city}`
}

export function parseOrganisationCityKey(key: string): { state: string; city: string } | null {
  const idx = key.indexOf(CITY_KEY_SEP)
  if (idx <= 0) return null
  const state = key.slice(0, idx)
  const city = key.slice(idx + CITY_KEY_SEP.length)
  if (!state.trim() || !city.trim()) return null
  return { state, city }
}

export function resolveOrganisationCitySelection(cityKey: string): {
  city: string
  state: string
  country: string
} {
  const parsed = parseOrganisationCityKey(cityKey)
  if (!parsed) {
    return { city: '', state: '', country: DEFAULT_ORGANISATION_COUNTRY }
  }
  return {
    city: parsed.city,
    state: parsed.state,
    country: DEFAULT_ORGANISATION_COUNTRY,
  }
}

export function matchOrganisationCityKey(city: string, state: string, country: string): string {
  const c = city.trim()
  const s = state.trim()
  if (!c || !s) return ''
  if (country.trim() && country.trim() !== DEFAULT_ORGANISATION_COUNTRY) return ''
  const cities = CITIES_BY_INDIAN_STATE[s]
  if (!cities?.includes(c)) return ''
  return organisationCityKey(s, c)
}

export function organisationCitiesForState(country: string, state: string): readonly string[] {
  if (country.trim() !== DEFAULT_ORGANISATION_COUNTRY) return []
  return CITIES_BY_INDIAN_STATE[state.trim()] ?? []
}

export function organisationCitySelectOptions(filter?: {
  country?: string
  state?: string
}): SearchableSelectOption[] {
  const country = (filter?.country ?? DEFAULT_ORGANISATION_COUNTRY).trim()
  const stateFilter = filter?.state?.trim() ?? ''

  if (country !== DEFAULT_ORGANISATION_COUNTRY) {
    return []
  }

  const entries: SearchableSelectOption[] = []

  const states = stateFilter ? [stateFilter] : INDIAN_STATES_AND_UTS
  for (const state of states) {
    const cities = CITIES_BY_INDIAN_STATE[state] ?? []
    for (const city of cities) {
      entries.push({
        value: organisationCityKey(state, city),
        label: city,
        description: state,
        keywords: `${city} ${state}`,
      })
    }
  }

  return entries.sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
}

export function organisationCountryOptions(): { value: string; label: string }[] {
  return ORGANISATION_COUNTRIES.map(c => ({ value: c, label: c }))
}

export function organisationStateOptions(country: string): { value: string; label: string }[] {
  return organisationStatesForCountry(country).map(s => ({ value: s, label: s }))
}
