export interface AreaOption {
  area: string;
  city: string;
  ward: string;
}

export const LOCATIONS: AreaOption[] = [
  // Delhi - Central
  { area: 'Connaught Place', city: 'Delhi', ward: 'Central Delhi Ward 1' },
  { area: 'Paharganj', city: 'Delhi', ward: 'Central Delhi Ward 2' },
  { area: 'Karol Bagh', city: 'Delhi', ward: 'Central Delhi Ward 3' },
  { area: 'Chandni Chowk', city: 'Delhi', ward: 'Central Delhi Ward 4' },
  { area: 'Civil Lines', city: 'Delhi', ward: 'North Delhi Ward 1' },
  { area: 'Model Town', city: 'Delhi', ward: 'North Delhi Ward 2' },
  { area: 'Subhash Nagar', city: 'Delhi', ward: 'North Delhi Ward 3' },
  // Delhi - South
  { area: 'Lajpat Nagar', city: 'Delhi', ward: 'South Delhi Ward 1' },
  { area: 'Greater Kailash I', city: 'Delhi', ward: 'South Delhi Ward 2' },
  { area: 'Greater Kailash II', city: 'Delhi', ward: 'South Delhi Ward 3' },
  { area: 'Hauz Khas', city: 'Delhi', ward: 'South Delhi Ward 4' },
  { area: 'Malviya Nagar', city: 'Delhi', ward: 'South Delhi Ward 5' },
  { area: 'Saket', city: 'Delhi', ward: 'South Delhi Ward 6' },
  { area: 'Vasant Kunj', city: 'Delhi', ward: 'South Delhi Ward 7' },
  { area: 'Vasant Vihar', city: 'Delhi', ward: 'South Delhi Ward 8' },
  { area: 'South Extension', city: 'Delhi', ward: 'South Delhi Ward 9' },
  { area: 'Nehru Place', city: 'Delhi', ward: 'South Delhi Ward 10' },
  // Delhi - West
  { area: 'Dwarka Sector 6', city: 'Delhi', ward: 'West Delhi Ward 1' },
  { area: 'Dwarka Sector 12', city: 'Delhi', ward: 'West Delhi Ward 2' },
  { area: 'Dwarka Sector 23', city: 'Delhi', ward: 'West Delhi Ward 3' },
  { area: 'Janakpuri', city: 'Delhi', ward: 'West Delhi Ward 4' },
  { area: 'Rajouri Garden', city: 'Delhi', ward: 'West Delhi Ward 5' },
  { area: 'Paschim Vihar', city: 'Delhi', ward: 'West Delhi Ward 6' },
  { area: 'Uttam Nagar', city: 'Delhi', ward: 'West Delhi Ward 7' },
  // Delhi - North-West
  { area: 'Rohini Sector 3', city: 'Delhi', ward: 'North West Delhi Ward 1' },
  { area: 'Rohini Sector 11', city: 'Delhi', ward: 'North West Delhi Ward 2' },
  { area: 'Pitampura', city: 'Delhi', ward: 'North West Delhi Ward 3' },
  { area: 'Shalimar Bagh', city: 'Delhi', ward: 'North West Delhi Ward 4' },
  { area: 'Ashok Vihar', city: 'Delhi', ward: 'North West Delhi Ward 5' },
  { area: 'Rani Bagh', city: 'Delhi', ward: 'North West Delhi Ward 6' },
  // Delhi - East
  { area: 'Shahdara', city: 'Delhi', ward: 'East Delhi Ward 1' },
  { area: 'Preet Vihar', city: 'Delhi', ward: 'East Delhi Ward 2' },
  { area: 'Mayur Vihar Phase 1', city: 'Delhi', ward: 'East Delhi Ward 3' },
  { area: 'Dilshad Garden', city: 'Delhi', ward: 'East Delhi Ward 4' },
  { area: 'Vivek Vihar', city: 'Delhi', ward: 'East Delhi Ward 5' },
  { area: 'Patparganj', city: 'Delhi', ward: 'East Delhi Ward 6' },
  { area: 'IP Extension', city: 'Delhi', ward: 'East Delhi Ward 7' },
  // Ghaziabad
  { area: 'Indirapuram', city: 'Ghaziabad', ward: 'Ghaziabad Ward 1' },
  { area: 'Vaishali Sector 1', city: 'Ghaziabad', ward: 'Ghaziabad Ward 2' },
  { area: 'Vaishali Sector 4', city: 'Ghaziabad', ward: 'Ghaziabad Ward 3' },
  { area: 'Kaushambi', city: 'Ghaziabad', ward: 'Ghaziabad Ward 4' },
  { area: 'Raj Nagar Extension', city: 'Ghaziabad', ward: 'Ghaziabad Ward 5' },
  { area: 'Raj Nagar', city: 'Ghaziabad', ward: 'Ghaziabad Ward 6' },
  { area: 'Sahibabad', city: 'Ghaziabad', ward: 'Ghaziabad Ward 7' },
  { area: 'Mohan Nagar', city: 'Ghaziabad', ward: 'Ghaziabad Ward 8' },
  { area: 'Vijay Nagar', city: 'Ghaziabad', ward: 'Ghaziabad Ward 9' },
  { area: 'Abhay Khand', city: 'Ghaziabad', ward: 'Ghaziabad Ward 10' },
  { area: 'Nyay Khand', city: 'Ghaziabad', ward: 'Ghaziabad Ward 11' },
  { area: 'Vasundhara Sector 1', city: 'Ghaziabad', ward: 'Ghaziabad Ward 12' },
  { area: 'Vasundhara Sector 4', city: 'Ghaziabad', ward: 'Ghaziabad Ward 13' },
  { area: 'Crossings Republik', city: 'Ghaziabad', ward: 'Ghaziabad Ward 14' },
  { area: 'Siddharth Vihar', city: 'Ghaziabad', ward: 'Ghaziabad Ward 15' },
  { area: 'Govindpuram', city: 'Ghaziabad', ward: 'Ghaziabad Ward 16' },
  { area: 'Pratap Vihar', city: 'Ghaziabad', ward: 'Ghaziabad Ward 17' },
  { area: 'Surya Nagar', city: 'Ghaziabad', ward: 'Ghaziabad Ward 18' },
  { area: 'Lal Kuan', city: 'Ghaziabad', ward: 'Ghaziabad Ward 19' },
  { area: 'Nandgram', city: 'Ghaziabad', ward: 'Ghaziabad Ward 20' },
  { area: 'Rajendra Nagar', city: 'Ghaziabad', ward: 'Ghaziabad Ward 21' },
  { area: 'Shastri Nagar', city: 'Ghaziabad', ward: 'Ghaziabad Ward 22' },
  { area: 'Gandhi Nagar', city: 'Ghaziabad', ward: 'Ghaziabad Ward 23' },
];

export const CITY_OPTIONS = ['All', 'Delhi', 'Ghaziabad'];
