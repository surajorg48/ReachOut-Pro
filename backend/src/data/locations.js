// Hierarchical location data: Country → State → Cities
module.exports = [
  {
    name: 'India', code: 'IN',
    states: [
      { name: 'Maharashtra', cities: ['Mumbai','Pune','Nagpur','Thane','Navi Mumbai','Nashik','Aurangabad'] },
      { name: 'Karnataka', cities: ['Bangalore','Mysore','Mangalore','Hubli','Belgaum'] },
      { name: 'Tamil Nadu', cities: ['Chennai','Coimbatore','Madurai','Salem','Trichy'] },
      { name: 'Telangana', cities: ['Hyderabad','Warangal','Nizamabad','Karimnagar'] },
      { name: 'Uttar Pradesh', cities: ['Noida','Lucknow','Kanpur','Agra','Varanasi','Ghaziabad'] },
      { name: 'Delhi', cities: ['New Delhi','Dwarka','Saket','Connaught Place'] },
      { name: 'Gujarat', cities: ['Ahmedabad','Surat','Vadodara','Rajkot','Gandhinagar'] },
      { name: 'Rajasthan', cities: ['Jaipur','Jodhpur','Udaipur','Kota','Ajmer'] },
      { name: 'West Bengal', cities: ['Kolkata','Howrah','Durgapur','Siliguri'] },
      { name: 'Kerala', cities: ['Kochi','Thiruvananthapuram','Kozhikode','Thrissur'] },
      { name: 'Madhya Pradesh', cities: ['Indore','Bhopal','Jabalpur','Gwalior'] },
      { name: 'Haryana', cities: ['Gurgaon','Faridabad','Panipat','Karnal','Rohtak'] },
      { name: 'Punjab', cities: ['Chandigarh','Ludhiana','Amritsar','Jalandhar','Mohali'] },
      { name: 'Andhra Pradesh', cities: ['Visakhapatnam','Vijayawada','Guntur','Tirupati'] },
      { name: 'Odisha', cities: ['Bhubaneswar','Cuttack','Rourkela'] },
      { name: 'Bihar', cities: ['Patna','Gaya','Muzaffarpur'] },
      { name: 'Jharkhand', cities: ['Ranchi','Jamshedpur','Dhanbad'] },
      { name: 'Assam', cities: ['Guwahati','Silchar','Dibrugarh'] },
      { name: 'Chhattisgarh', cities: ['Raipur','Bhilai','Bilaspur'] },
      { name: 'Goa', cities: ['Panaji','Margao','Vasco da Gama'] },
      { name: 'Uttarakhand', cities: ['Dehradun','Haridwar','Rishikesh'] },
      { name: 'Himachal Pradesh', cities: ['Shimla','Dharamsala','Manali'] },
    ]
  },
  {
    name: 'United States', code: 'US',
    states: [
      { name: 'California', cities: ['San Francisco','Los Angeles','San Diego','San Jose','Sacramento'] },
      { name: 'New York', cities: ['New York City','Buffalo','Albany','Rochester'] },
      { name: 'Texas', cities: ['Houston','Dallas','Austin','San Antonio'] },
      { name: 'Washington', cities: ['Seattle','Tacoma','Spokane','Bellevue'] },
      { name: 'Massachusetts', cities: ['Boston','Cambridge','Worcester'] },
      { name: 'Illinois', cities: ['Chicago','Springfield','Naperville'] },
      { name: 'Georgia', cities: ['Atlanta','Savannah','Augusta'] },
      { name: 'Florida', cities: ['Miami','Orlando','Tampa','Jacksonville'] },
      { name: 'Pennsylvania', cities: ['Philadelphia','Pittsburgh','Allentown'] },
      { name: 'Colorado', cities: ['Denver','Colorado Springs','Boulder'] },
      { name: 'Virginia', cities: ['Richmond','Arlington','Virginia Beach'] },
      { name: 'North Carolina', cities: ['Charlotte','Raleigh','Durham'] },
    ]
  },
  {
    name: 'United Kingdom', code: 'GB',
    states: [
      { name: 'England', cities: ['London','Manchester','Birmingham','Leeds','Bristol','Liverpool'] },
      { name: 'Scotland', cities: ['Edinburgh','Glasgow','Aberdeen'] },
      { name: 'Wales', cities: ['Cardiff','Swansea'] },
    ]
  },
  {
    name: 'Canada', code: 'CA',
    states: [
      { name: 'Ontario', cities: ['Toronto','Ottawa','Mississauga','Waterloo'] },
      { name: 'British Columbia', cities: ['Vancouver','Victoria','Surrey'] },
      { name: 'Quebec', cities: ['Montreal','Quebec City'] },
      { name: 'Alberta', cities: ['Calgary','Edmonton'] },
    ]
  },
  {
    name: 'Australia', code: 'AU',
    states: [
      { name: 'New South Wales', cities: ['Sydney','Newcastle'] },
      { name: 'Victoria', cities: ['Melbourne','Geelong'] },
      { name: 'Queensland', cities: ['Brisbane','Gold Coast'] },
      { name: 'Western Australia', cities: ['Perth','Fremantle'] },
    ]
  },
  {
    name: 'Germany', code: 'DE',
    states: [
      { name: 'Bavaria', cities: ['Munich','Nuremberg','Augsburg'] },
      { name: 'Berlin', cities: ['Berlin'] },
      { name: 'Hesse', cities: ['Frankfurt','Darmstadt','Wiesbaden'] },
      { name: 'North Rhine-Westphalia', cities: ['Cologne','Dusseldorf','Dortmund'] },
    ]
  },
  {
    name: 'UAE', code: 'AE',
    states: [
      { name: 'Dubai', cities: ['Dubai'] },
      { name: 'Abu Dhabi', cities: ['Abu Dhabi'] },
      { name: 'Sharjah', cities: ['Sharjah'] },
    ]
  },
  {
    name: 'Singapore', code: 'SG',
    states: [{ name: 'Singapore', cities: ['Singapore'] }]
  },
];
