export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  states: string[];
}

export const COUNTRIES: CountryOption[] = [
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    states: [
      'Andhra Pradesh',
      'Arunachal Pradesh',
      'Assam',
      'Bihar',
      'Chhattisgarh',
      'Goa',
      'Gujarat',
      'Haryana',
      'Himachal Pradesh',
      'Jharkhand',
      'Karnataka',
      'Kerala',
      'Madhya Pradesh',
      'Maharashtra',
      'Manipur',
      'Meghalaya',
      'Mizoram',
      'Nagaland',
      'Odisha',
      'Punjab',
      'Rajasthan',
      'Sikkim',
      'Tamil Nadu',
      'Telangana',
      'Tripura',
      'Uttar Pradesh',
      'Uttarakhand',
      'West Bengal',
      'Andaman and Nicobar Islands',
      'Chandigarh',
      'Dadra and Nagar Haveli and Daman and Diu',
      'Delhi (NCT)',
      'Jammu and Kashmir',
      'Ladakh',
      'Lakshadweep',
      'Puducherry'
    ]
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    states: [
      'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
      'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
      'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
      'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
      'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
      'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
      'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
      'Wisconsin', 'Wyoming', 'District of Columbia', 'Puerto Rico'
    ]
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    states: ['England', 'Scotland', 'Wales', 'Northern Ireland']
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    states: [
      'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
      'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island',
      'Quebec', 'Saskatchewan', 'Northwest Territories', 'Nunavut', 'Yukon'
    ]
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    states: [
      'Australian Capital Territory', 'New South Wales', 'Northern Territory',
      'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'
    ]
  },
  {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    states: ['Central Region', 'East Region', 'North Region', 'North-East Region', 'West Region']
  },
  {
    code: 'MY',
    name: 'Malaysia',
    flag: '🇲🇾',
    states: [
      'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang',
      'Penang', 'Perak', 'Perlis', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
      'Kuala Lumpur', 'Labuan', 'Putrajaya'
    ]
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    states: ['Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain']
  },
  {
    code: 'LK',
    name: 'Sri Lanka',
    flag: '🇱🇰',
    states: ['Central', 'Eastern', 'North Central', 'Northern', 'North Western', 'Sabaragamuwa', 'Southern', 'Uva', 'Western']
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    states: [
      'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen',
      'Hamburg', 'Hesse', 'Lower Saxony', 'Mecklenburg-Vorpommern', 'North Rhine-Westphalia',
      'Rhineland-Palatinate', 'Saarland', 'Saxony', 'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia'
    ]
  },
  {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    states: [
      'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Brittany', 'Centre-Val de Loire',
      'Corsica', 'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandy',
      'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', 'Provence-Alpes-Côte d\'Azur'
    ]
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    states: ['Riyadh', 'Makkah', 'Eastern Province', 'Madinah', 'Al Baha', 'Al Jawf', 'Asir', 'Hail', 'Jazan', 'Najran', 'Tabuk', 'Qassim']
  },
  {
    code: 'QA',
    name: 'Qatar',
    flag: '🇶🇦',
    states: ['Doha', 'Al Rayyan', 'Al Wakrah', 'Al Khor', 'Al Shamal', 'Umm Salal', 'Al Daayen', 'Al Sheehaniya']
  },
  {
    code: 'OM',
    name: 'Oman',
    flag: '🇴🇲',
    states: ['Muscat', 'Dhofar', 'Musandam', 'Al Buraimi', 'Al Dakhiliyah', 'Al Batinah North', 'Al Batinah South', 'Al Sharqiyah North', 'Al Sharqiyah South', 'Al Wusta', 'Al Dhahirah']
  },
  {
    code: 'KW',
    name: 'Kuwait',
    flag: '🇰🇼',
    states: ['Al Asimah', 'Hawalli', 'Farwaniya', 'Ahmadi', 'Jahra', 'Mubarak Al-Kabeer']
  },
  {
    code: 'BH',
    name: 'Bahrain',
    flag: '🇧🇭',
    states: ['Capital Governorate', 'Muharraq Governorate', 'Northern Governorate', 'Southern Governorate']
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    flag: '🇳🇿',
    states: ['Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawke\'s Bay', 'Manawatū-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago', 'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast']
  },
  {
    code: 'ZA',
    name: 'South Africa',
    flag: '🇿🇦',
    states: ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape']
  },
  {
    code: 'NP',
    name: 'Nepal',
    flag: '🇳🇵',
    states: ['Bagmati', 'Gandaki', 'Karnali', 'Koshi', 'Lumbini', 'Madhesh', 'Sudurpashchim']
  },
  {
    code: 'MU',
    name: 'Mauritius',
    flag: '🇲🇺',
    states: ['Black River', 'Flacq', 'Grand Port', 'Moka', 'Pamplemousses', 'Plaines Wilhems', 'Port Louis', 'Rivière du Rempart', 'Savanne']
  },
  {
    code: 'BD',
    name: 'Bangladesh',
    flag: '🇧🇩',
    states: ['Barishal', 'Chattogram', 'Dhaka', 'Khulna', 'Mymensingh', 'Rajshahi', 'Rangpur', 'Sylhet']
  },
  {
    code: 'ID',
    name: 'Indonesia',
    flag: '🇮🇩',
    states: ['Bali', 'Banten', 'Central Java', 'East Java', 'Jakarta', 'West Java', 'Yogyakarta', 'North Sumatra', 'South Sumatra']
  },
  {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    states: ['Tokyo', 'Osaka', 'Kyoto', 'Hokkaido', 'Aichi', 'Fukuoka', 'Kanagawa', 'Hyogo', 'Saitama', 'Chiba']
  },
  {
    code: 'TH',
    name: 'Thailand',
    flag: '🇹🇭',
    states: ['Bangkok', 'Chiang Mai', 'Phuket', 'Chonburi', 'Nonthaburi', 'Pathum Thani', 'Samut Prakan']
  },
  {
    code: 'IE',
    name: 'Ireland',
    flag: '🇮🇪',
    states: ['Connacht', 'Leinster', 'Munster', 'Ulster']
  },
  {
    code: 'NL',
    name: 'Netherlands',
    flag: '🇳🇱',
    states: ['North Holland', 'South Holland', 'Utrecht', 'North Brabant', 'Gelderland', 'Overijssel', 'Limburg']
  },
  {
    code: 'CH',
    name: 'Switzerland',
    flag: '🇨🇭',
    states: ['Zurich', 'Bern', 'Lucerne', 'Geneva', 'Vaud', 'Basel-City', 'St. Gallen']
  },
  {
    code: 'IT',
    name: 'Italy',
    flag: '🇮🇹',
    states: ['Lombardy', 'Lazio', 'Campania', 'Veneto', 'Sicily', 'Piedmont', 'Emilia-Romagna', 'Tuscany']
  },
  {
    code: 'ES',
    name: 'Spain',
    flag: '🇪🇸',
    states: ['Madrid', 'Catalonia', 'Andalusia', 'Valencia', 'Galicia', 'Castile and León', 'Basque Country']
  },
  {
    code: 'BR',
    name: 'Brazil',
    flag: '🇧🇷',
    states: ['São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Bahia', 'Paraná', 'Rio Grande do Sul']
  },
  {
    code: 'MX',
    name: 'Mexico',
    flag: '🇲🇽',
    states: ['Mexico City', 'Jalisco', 'Nuevo León', 'Puebla', 'Guanajuato', 'Veracruz']
  },
  {
    code: 'PH',
    name: 'Philippines',
    flag: '🇵🇭',
    states: ['Metro Manila', 'Cebu', 'Davao', 'Iloilo', 'Pampanga', 'Cavite', 'Laguna', 'Rizal', 'Batangas']
  },
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫', states: [] },
  { code: 'AL', name: 'Albania', flag: '🇦🇱', states: [] },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿', states: [] },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', states: [] },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', states: [] },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', states: [] },
  { code: 'BT', name: 'Bhutan', flag: '🇧🇹', states: [] },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', states: [] },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', states: [] },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', states: [] },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', states: [] },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', states: [] },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', states: [] },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', states: [] },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', states: [] },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', states: [] },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', states: [] },
  { code: 'MV', name: 'Maldives', flag: '🇲🇻', states: [] },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲', states: [] },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', states: [] },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', states: [] },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', states: [] },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', states: [] },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', states: [] },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', states: [] },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', states: [] },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', states: [] },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', states: [] }
];

export const CITIES_BY_STATE: Record<string, string[]> = {
  // Tamil Nadu
  'Tamil Nadu': [
    'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli',
    'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi', 'Dindigul', 'Thanjavur',
    'Ranipet', 'Sivakasi', 'Karur', 'Udhagamandalam (Ooty)', 'Hosur', 'Nagercoil',
    'Kanchipuram', 'Kumarapalayam', 'Karaikkudi', 'Neyveli', 'Cuddalore', 'Kumbakonam',
    'Tiruvannamalai', 'Pollachi', 'Rajapalayam', 'Gudiyatham', 'Pudukkottai', 'Vaniyambadi',
    'Ambur', 'Nagapattinam', 'Namakkal', 'Krishnagiri', 'Dharmapuri', 'Perambalur',
    'Ramanathapuram', 'Theni', 'Ariyalur', 'Tenkasi', 'Mayiladuthurai', 'Chengalpattu',
    'Kallakurichi', 'Ranipet', 'Tirupattur', 'Kanyakumari'
  ],
  // Karnataka
  'Karnataka': [
    'Bengaluru', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru', 'Belagavi', 'Davangere',
    'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Raichur', 'Bidar',
    'Hosapete', 'Gadag', 'Udupi', 'Hassan', 'Bhadravati', 'Chitradurga', 'Kolar', 'Mandya'
  ],
  // Kerala
  'Kerala': [
    'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Kollam', 'Thrissur', 'Palakkad',
    'Alappuzha', 'Malappuram', 'Ponnani', 'Vatakara', 'Kanhangad', 'Taliparamba',
    'Kottayam', 'Kasaragod', 'Kannur', 'Pathanamthitta', 'Idukki', 'Wayanad'
  ],
  // Andhra Pradesh
  'Andhra Pradesh': [
    'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Kakinada',
    'Rajahmundry', 'Tirupati', 'Kadapa', 'Anantapur', 'Vizianagaram', 'Eluru',
    'Ongole', 'Nandyal', 'Machilipatnam', 'Adoni', 'Tenali', 'Proddatur', 'Chittoor'
  ],
  // Telangana
  'Telangana': [
    'Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar', 'Ramagundam',
    'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Suryapet', 'Miryalaguda', 'Siddipet'
  ],
  // Maharashtra
  'Maharashtra': [
    'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Kalyan-Dombivli',
    'Vasai-Virar', 'Chhatrapati Sambhajinagar', 'Navi Mumbai', 'Solapur',
    'Mira-Bhayandar', 'Bhiwandi', 'Amravati', 'Nanded', 'Kolhapur', 'Akola', 'Panvel'
  ],
  // Gujarat
  'Gujarat': [
    'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar',
    'Junagadh', 'Gandhinagar', 'Anand', 'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch'
  ],
  // Delhi
  'Delhi (NCT)': [
    'New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi',
    'Central Delhi', 'North East Delhi', 'North West Delhi', 'South East Delhi', 'South West Delhi'
  ],
  // Uttar Pradesh
  'Uttar Pradesh': [
    'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut',
    'Prayagraj (Allahabad)', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur',
    'Noida', 'Firozabad', 'Jhansi', 'Muzaffarnagar', 'Mathura', 'Ayodhya'
  ],
  // West Bengal
  'West Bengal': [
    'Kolkata', 'Howrah', 'Asansol', 'Siliguri', 'Durgapur', 'Bardhaman',
    'Malda', 'Baharampur', 'Habra', 'Kharagpur', 'Shantipur', 'Dankuni'
  ],
  // Rajasthan
  'Rajasthan': [
    'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur',
    'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar', 'Pali', 'Sri Ganganagar'
  ],
  // Punjab
  'Punjab': [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Hoshiarpur',
    'Mohali', 'Batala', 'Pathankot', 'Moga', 'Abohar', 'Malerkotla'
  ],
  // Puducherry
  'Puducherry': [
    'Puducherry', 'Karaikal', 'Mahe', 'Yanam', 'Oulgaret'
  ],

  // United States popular states
  'California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Fresno', 'Oakland'],
  'New York': ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany'],
  'Texas': ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington'],
  'Florida': ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'St. Petersburg', 'Fort Lauderdale'],
  'Washington': ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Olympia'],
  'Illinois': ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield'],

  // United Kingdom
  'England': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Newcastle', 'Bristol', 'Sheffield'],
  'Scotland': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness'],
  'Wales': ['Cardiff', 'Swansea', 'Newport', 'Wrexham'],
  'Northern Ireland': ['Belfast', 'Derry', 'Lisburn', 'Newry'],

  // Canada
  'Ontario': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham'],
  'British Columbia': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond', 'Kelowna'],
  'Quebec': ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke'],

  // Australia
  'New South Wales': ['Sydney', 'Newcastle', 'Central Coast', 'Wollongong', 'Maitland'],
  'Victoria': ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo', 'Shepparton'],
  'Queensland': ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns'],

  // UAE
  'Dubai': ['Dubai City', 'Deira', 'Bur Dubai', 'Jumeirah', 'Al Barsha', 'Downtown Dubai'],
  'Abu Dhabi': ['Abu Dhabi City', 'Al Ain', 'Al Dhafra', 'Mussafah'],
  'Sharjah': ['Sharjah City', 'Khor Fakkan', 'Kalba', 'Al Dhaid']
};

export function getCountryByName(name: string): CountryOption | undefined {
  if (!name) return undefined;
  return COUNTRIES.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
}

export function getStatesForCountry(countryName: string): string[] {
  const country = getCountryByName(countryName);
  return country ? country.states : [];
}

export function getCitiesForState(stateName: string): string[] {
  if (!stateName) return [];
  const stateClean = stateName.trim();
  // Check exact match
  if (CITIES_BY_STATE[stateClean]) {
    return CITIES_BY_STATE[stateClean];
  }
  // Case-insensitive lookup
  const key = Object.keys(CITIES_BY_STATE).find((k) => k.toLowerCase() === stateClean.toLowerCase());
  return key ? CITIES_BY_STATE[key] : [];
}
