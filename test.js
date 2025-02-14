function generatePropertyRichText(propertyDetails) {
    const output = [];
    
    if (propertyDetails.image) {
      output.push(`![Property Image](${propertyDetails.image})`);
    }
  
    // Section builder with conditional headings
    const buildSection = (title, items) => {
      if (items.length === 0) return;
      output.push(`*${title.toUpperCase()}*`);
      output.push(...items);
      output.push('╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌');
    };
  
    // Core Information
    const coreInfo = [];
    if (propertyDetails.bhk) coreInfo.push(`🛏️ *${propertyDetails.bhk} BHK*`);
    if (propertyDetails.property_type) coreInfo.push(`🏠 _Type:_ ${propertyDetails.property_type}`);
    if (propertyDetails.preferred_tenant) coreInfo.push(`👤 _Tenant Preference:_ ${propertyDetails.preferred_tenant}`);
    if (propertyDetails.possession) coreInfo.push(`📅 _Possession:_ ${propertyDetails.possession}`);
    buildSection('Property Overview', coreInfo);
  
    // Structural Details
    const structure = [];
    if (propertyDetails.floor) structure.push(`↕️ _Floor:_ ${propertyDetails.floor}`);
    if (propertyDetails.facing) structure.push(`🧭 _Facing:_ ${propertyDetails.facing}`);
    if (propertyDetails.balcony) structure.push(`🌇 _Balconies:_ ${propertyDetails.balcony}`);
    if (propertyDetails.parking) structure.push(`🚗 _Parking:_ ${propertyDetails.parking}`);
    if (propertyDetails.age_of_building) {
      const age = isNaN(propertyDetails.age_of_building) 
        ? propertyDetails.age_of_building 
        : `${propertyDetails.age_of_building} years`;
      structure.push(`🏗️ _Building Age:_ ${age}`);
    }
    buildSection('Building Specifications', structure);
  
    // Location & Amenities
    const location = [];
    if (propertyDetails.address) {
      location.push(`📍 *Address:*\n${propertyDetails.address.replace(/,/g, ',\n')}`);
    }
    if (propertyDetails.other_amentities) {
      const amenities = Array.isArray(propertyDetails.other_amentities)
        ? propertyDetails.other_amentities.join('\n• ')
        : propertyDetails.other_amentities;
      location.push(`\n✅ *Key Amenities:*\n• ${amenities}`);
    }
    buildSection('Location Features', location);
  
    // Final cleanup and formatting
    if (output.length > 0) {
      // Remove last separator line
      output.pop();
      // Add footer
      output.push('\n_ℹ️ Contact agent for more details_');
    }
  
    return output.length > 0 ? output : ['*No property details available*'];
}


const propertyDetails = {
    bhk: "3",
    property_type: "Apartment",
    preferred_tenant: "Family",
    possession: "Immediate",
    parking: "2 Covered",
    age_of_building: "2 Years",
    balcony: "2",
    floor: "12",
    facing: "North-East",
    address: "123, Green Valley, Sector 62, Noida",
    other_amentities: [
        "24x7 Security",
        "Power Backup",
        "Swimming Pool",
        "Gym",
        "Club House"
    ]
};

[
  {
    "id": 0,
    "body": "Are you a parent or player?",
    "type": "Button",
    "variable": "parentOrPlayer",
    "variableType": "parentOrPlayer"
  },
  {
    "id": 1,
    "body": "Parent",
    "type": "button_element"
  },
  {
    "id": 2,
    "body": "Player",
    "type": "button_element"
  },
  {
    "id": 3,
    "type": "template",
    "Chelsea": "chelseacarousel",
    "Juventus": "updatedcarouselfordrona",
    "Liverpool": "liverpoolcarousel"
  },
  {
    "id": 4,
    "body": "Let's proceed further",
    "type": "Button"
  },
  {
    "id": 5,
    "body": "Sign Up",
    "type": "button_element"
  },
  {
    "id": 6,
    "body": "Learn More",
    "type": "button_element"
  },
  {
    "id": 7,
    "body": "What is the age of the player?",
    "type": "List",
    "variable": "age",
    "variableType": "age"
  },
  {
    "id": 8,
    "body": "8 years",
    "type": "list_element"
  },
  {
    "id": 9,
    "body": "9 years",
    "type": "list_element"
  },
  {
    "id": 10,
    "body": "10 years",
    "type": "list_element"
  },
  {
    "id": 11,
    "body": "11 years",
    "type": "list_element"
  },
  {
    "id": 12,
    "body": "12 years",
    "type": "list_element"
  },
  {
    "id": 13,
    "body": "13 years",
    "type": "list_element"
  },
  {
    "id": 14,
    "body": "14 years",
    "type": "list_element"
  },
  {
    "id": 15,
    "body": "Position at which the player play at",
    "type": "List",
    "variable": "position",
    "variableType": "position"
  },
  {
    "id": 16,
    "body": "Goal Keeper",
    "type": "list_element"
  },
  {
    "id": 17,
    "body": "Right Back / Left Back",
    "type": "list_element"
  },
  {
    "id": 18,
    "body": "Sweeper",
    "type": "list_element"
  },
  {
    "id": 19,
    "body": "Center Back",
    "type": "list_element"
  },
  {
    "id": 20,
    "body": "Defend Midfielder",
    "type": "list_element"
  },
  {
    "id": 21,
    "body": "R Wing/ L Wing",
    "type": "list_element"
  },
  {
    "id": 22,
    "body": "Center Mid",
    "type": "list_element"
  },
  {
    "id": 23,
    "body": "Striker / Center Forward",
    "type": "list_element"
  },
  {
    "id": 24,
    "body": "Center Attack Mid",
    "type": "list_element"
  },
  {
    "id": 25,
    "body": "Send your location",
    "type": "Text",
    "variable": "location",
    "variableType": "location"
  },
  {
    "id": 26,
    "body": "Which school does the player attend?",
    "type": "Text",
    "variable": "school_name",
    "variableType": "school_name"
  },
  {
    "id": 27,
    "body": "What is the best time to call you?",
    "type": "Button",
    "variable": "time",
    "variableType": "time"
  },
  {
    "id": 28,
    "body": "Today",
    "type": "button_element"
  },
  {
    "id": 29,
    "body": "Tomorrow",
    "type": "button_element"
  },
  {
    "id": 30,
    "body": "Insert Manually",
    "type": "button_element"
  },
  {
    "id": 31,
    "body": "Please enter date and time at which you expect us to call",
    "type": "Text",
    "variable": "custom_time",
    "variableType": "custom_time"
  },
  {
    "id": 32,
    "body": {
      "caption": "Check out last year's tour to Alicante Football Academy, Alicante, Spain.",
      "videoID": 594849516703823
    },
    "type": "video"
  },
  {
    "id": 33,
    "body": "Does the player go to any academy?",
    "type": "Button"
  },
  {
    "id": 34,
    "body": "Yes",
    "type": "button_element"
  },
  {
    "id": 35,
    "body": "No",
    "type": "button_element"
  },
  {
    "id": 36,
    "body": "What is the name of the current academy?",
    "type": "Text",
    "variable": "current_academy",
    "variableType": "current_academy"
  },
  {
    "id": 37,
    "body": "Also check out:",
    "type": "Button"
  },
  {
    "id": 38,
    "body": "Parent Testimonial",
    "type": "button_element"
  },
  {
    "id": 39,
    "body": "Other Programs",
    "type": "button_element"
  },
  {
    "id": 40,
    "body": {
      "videoID": 1477987313606593
    },
    "type": "video"
  },
  {
    "id": 41,
    "body": "Other programs:",
    "type": "Button"
  },
  {
    "id": 42,
    "body": "Liverpool FC Program",
    "type": "button_element"
  },
  {
    "id": 43,
    "body": "Chelsea FC Program",
    "type": "button_element"
  },
  {
    "id": 44,
    "body": "Long Term",
    "type": "button_element"
  },
  {
    "id": 45,
    "body": "Long Term Plans:",
    "type": "Button"
  },
  {
    "id": 46,
    "body": "Alicante FA",
    "type": "button_element"
  },
  {
    "id": 47,
    "body": "Wospac Barcelona",
    "type": "button_element"
  },
  {
    "id": 48,
    "body": "Type \"Hello! Can I get more info about the Liverpool FC Program?\" in the chat.\n",
    "type": "string"
  },
  {
    "id": 49,
    "body": "Type \"Hello! Can I get more info about the Chelsea FC Program?\" in the chat.\n",
    "type": "string"
  },
  {
    "id": 50,
    "body": "information about Alicante Football Academy",
    "type": "string"
  },
  {
    "id": 51,
    "body": "information about Wospac Barcelona",
    "type": "string"
  }
]

[
  [
    1,
    2
  ],
  [
    3
  ],
  [
    3
  ],
  [
    4
  ],
  [
    5,
    6
  ],
  [
    7
  ],
  [
    27
  ],
  [
    8,
    9,
    10,
    11,
    12,
    13,
    14
  ],
  [
    15
  ],
  [
    15
  ],
  [
    15
  ],
  [
    15
  ],
  [
    15
  ],
  [
    15
  ],
  [
    15
  ],
  [
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24
  ],
  [
    25
  ],
  [
    25
  ],
  [
    25
  ],
  [
    25
  ],
  [
    25
  ],
  [
    25
  ],
  [
    25
  ],
  [
    25
  ],
  [
    25
  ],
  [
    26
  ],
  [
    33
  ],
  [
    28,
    29,
    30
  ],
  [
    32
  ],
  [
    32
  ],
  [
    31
  ],
  [
    32
  ],
  [
    37
  ],
  [
    34,
    35
  ],
  [
    36
  ],
  [
    27
  ],
  [
    27
  ],
  [
    38,
    39
  ],
  [
    40
  ],
  [
    41
  ],
  [],
  [
    42,
    43,
    44
  ],
  [
    48
  ],
  [
    49
  ],
  [
    45
  ],
  [
    46,
    47
  ],
  [
    50
  ],
  [
    51
  ],
  [],
  [],
  [],
  []
]