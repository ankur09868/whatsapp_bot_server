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
