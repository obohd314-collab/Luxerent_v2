import { Property } from "../types";

export const DEMO_PROPERTIES: Property[] = [
  {
    id: "prop_ikoyi_penthouse",
    title: "Celestial 4-Bedroom Sky Penthouse",
    description: "Experience absolute luxury in this breathtaking, ultra-modern penthouse suspended high above the Ikoyi sky. Features floor-to-ceiling glass windows offering a panoramic 360-degree overlook of the Lagos Lagoon, fully custom automated home automation system, a private heated infinity pool, expansive wrap-around terraces, and detailed Italian marble flooring. Standard high-speed internet, 24/7 dedicated professional security, clean solar backup inverter with silent generator redundancy, and a double-volume high ceiling parlour.",
    price: 18000000, // \u20a618M per year
    location: "Lagos",
    address: "Bourdillon Road, Ikoyi",
    propertyType: "penthouse",
    bedrooms: 4,
    bathrooms: 4,
    amenities: ["LAGOS LAGOON VIEW", "PRIVATE INFINITY POOL", "SMART AUTOMATION", "24/7 SOLAR POWER", "CONCIERGE SERVICE", "PRIVATE ELEVATOR", "FITTED GYM"],
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=1200"
    ],
    videoTourUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    status: "available",
    landlordId: "landlord_seeded_1",
    landlordName: "Chief Aliyu Danladi (Luxe Holdings)",
    isApproved: true,
    views: 342,
    createdAt: new Date().toISOString(),
    latitude: 6.4520,
    longitude: 3.4430,
    isFurnished: true
  },
  {
    id: "prop_lekki_duplex",
    title: "Avant-Garde 5-Bedroom Smart Duplex",
    description: "Built for modern comfort, this architectural masterpiece in the heart of Lekki Phase 1 offers 5 ensuite bedrooms with exquisite walk-in closets, a state-of-the-art cinema room, a fully equipped chef kitchen with premium built-in appliances, and a beautiful outdoor water cascade lounge. Complete with high-grade security biometric access control, a swimming pool, smart motorized curtains, a designated boys' quarters, and a dedicated EV charging station.",
    price: 12000000, // ₦12M per year
    location: "Lagos",
    address: "Block 12, Admiralty Way, Lekki Phase 1",
    propertyType: "duplex",
    bedrooms: 5,
    bathrooms: 5,
    amenities: ["PRIVATE CINEMA", "BIOMETRIC SECURITY", "SWIMMING POOL", "EXQUISITE WALK-IN CLOSETS", "CHEF KITCHEN", "BOYS QUARTERS"],
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&q=80&w=1200"
    ],
    videoTourUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    status: "available",
    landlordId: "landlord_seeded_2",
    landlordName: "Mrs. Funmi Benson (ProEdge Realty)",
    isApproved: true,
    views: 189,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    latitude: 6.4480,
    longitude: 3.4720,
    isFurnished: true
  },
  {
    id: "prop_maitama_villa",
    title: "Vanguard 6-Bedroom Diplomatic Villa",
    description: "Nestled in Lagos' finest diplomatic enclave in Banana Island, this majestic detached villa sits on over 1,200 square meters of lush manicured grounds. Ideal for high-profile diplomats or top corporate executives, it features incredibly spacious living parlors, automated smart lighting systems, a private gym, detached dual boys' quarters, bulletproof security glass, a professional-grade swimming pool, and dedicated security guards' gatehouse.",
    price: 25000000, // ₦25M per year
    location: "Lagos",
    address: "Aso Avenue, Banana Island, Ikoyi",
    propertyType: "villa",
    bedrooms: 6,
    bathrooms: 6,
    amenities: ["DIPLOMATIC ENCLAVE", "BULLETPROOF ACCESS", "PROFESSIONAL GYM", "MANICURED LAWN", "LARGE POOL", "TRIPLE GARAGE", "Biometric Access"],
    images: [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&q=80&w=1200"
    ],
    videoTourUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    status: "available",
    landlordId: "landlord_seeded_1",
    landlordName: "Chief Aliyu Danladi (Luxe Holdings)",
    isApproved: true,
    views: 254,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    latitude: 6.4640,
    longitude: 3.4938,
    isFurnished: false
  },
  {
    id: "prop_katampe_apartment",
    title: "Panoramic 3-Bedroom Luxury Apartment",
    description: "This highly detailed 3-bedroom, all ensuite apartment sits high on the Lekki Oniru hills, offering gorgeous elevated dusk views over the Atlantic ocean. Incorporates smart security, modular German kitchen layout, massive private balconies, energy-efficient central cooling systems, an ambient rooftop infinity deck, automated entry gates, and clean corporate water treatments.",
    price: 7000000, // ₦7M per year
    location: "Lagos",
    address: "Katampe Extension, Oniru, Lekki",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 4,
    amenities: ["PANORAMIC HILLVIEW", "BALCONIES", "ROOFTOP DECK", "REVERSE OSMOSIS WATER", "CENTRAL AIR CONDITIONING"],
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200"
    ],
    videoTourUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    status: "available",
    landlordId: "landlord_seeded_3",
    landlordName: "Dr. Jude Nwosu (Apex Properties)",
    isApproved: true,
    views: 95,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    latitude: 6.4350,
    longitude: 3.4470,
    isFurnished: true
  },
  {
    id: "prop_yaba_studio",
    title: "Urban Minimalist Smart Studio Apartment",
    description: "Perfect for young tech professionals or remote creators in the heart of Nigeria's Silicon Valley (Yaba). Optimally designed studio apartment features high-speed fibre broadband pre-wired, automated door locks, workspace cabinetry, sleek custom spotlighting, and 24/7 power supply optimized through a hybrid rooftop solar grid. Includes laundry units, modern bathrooms, and secure gate protection.",
    price: 2500000, // ₦2.5M per year
    location: "Lagos",
    address: "Herbert Macaulay Way, Yaba",
    propertyType: "studio",
    bedrooms: 1,
    bathrooms: 1,
    amenities: ["HIGH-SPEED FIBRE WIFI", "24/7 POWER", "LAUNDRY SYSTEMS", "SMART LOCKS", "SECURED ESTATE"],
    images: [
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&q=80&w=1200"
    ],
    videoTourUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    status: "available",
    landlordId: "landlord_seeded_2",
    landlordName: "Mrs. Funmi Benson (ProEdge Realty)",
    isApproved: true,
    views: 412,
    createdAt: new Date().toISOString(),
    latitude: 6.5095,
    longitude: 3.3792,
    isFurnished: false
  },
  {
    id: "prop_ph_duplex",
    title: "Neo-Classical 4-Bedroom Luxury Duplex",
    description: "Located within the highly secure, peaceful GRA Phase II in Ikeja, Lagos, this exquisite 4-bedroom detached duplex combines classic architecture with modern tech layouts. Features spacious luxury ensuite rooms, marble finish master suites with open showers, biometric security perimeter wires, massive double-door refrigerator ready kitchen cabinets, clean municipal water filters, and a spacious children backyard.",
    price: 4500000, // ₦4.5M per year
    location: "Lagos",
    address: "Tombia Street, GRA Phase II, Ikeja",
    propertyType: "duplex",
    bedrooms: 4,
    bathrooms: 4,
    amenities: ["SERENE GRA ESTATE", "CHILDRENS BACKYARD", "MARBLE BATHS", "BIOMETRIC PERIMETER SECURITY", "FULLY DETACHED"],
    images: [
      "https://images.unsplash.com/photo-1512915922686-57c11dde9b6b?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&q=80&w=1200"
    ],
    videoTourUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    status: "available",
    landlordId: "landlord_seeded_3",
    landlordName: "Dr. Jude Nwosu (Apex Properties)",
    isApproved: true,
    views: 110,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    latitude: 6.5925,
    longitude: 3.3550,
    isFurnished: true
  }
];
