"""Seed HSN/SAC codes into database — run once after create_tables.sql."""

HSN_CODES = [
    # Steel & Iron
    ("7304", "Steel pipes and tubes", 18, "Steel", "steel pipe tube ms"),
    ("7308", "Steel structures and parts", 18, "Steel", "steel structure angle flat bar channel"),
    ("7306", "Steel tubes welded", 18, "Steel", "steel tube welded"),
    ("7210", "Steel flat-rolled coated", 18, "Steel", "steel sheet plate coil galvanized"),
    ("7213", "Steel bars hot-rolled", 18, "Steel", "steel bar rod tmt saria"),
    ("7214", "Steel bars forged", 18, "Steel", "steel bar forged"),
    ("7217", "Steel wire", 18, "Steel", "steel wire binding"),
    # Building Materials
    ("2523", "Cement", 28, "Building", "cement opc ppc ultratech ambuja acc"),
    ("6802", "Stone tiles marble", 18, "Building", "marble granite tile stone slab"),
    ("6907", "Ceramic tiles", 18, "Building", "ceramic tile floor wall vitrified"),
    ("6810", "Cement products", 18, "Building", "cement block brick precast"),
    ("2505", "Sand", 5, "Building", "sand river crushed"),
    ("6811", "Cement sheets", 18, "Building", "cement sheet asbestos"),
    # Electrical
    ("8544", "Electric wire and cable", 18, "Electrical", "wire cable copper electric"),
    ("8536", "Electrical switches", 18, "Electrical", "switch socket plug board"),
    ("8539", "Electric lamps LED", 18, "Electrical", "led bulb lamp tube light"),
    ("9405", "Lighting fixtures", 18, "Electrical", "light fitting fixture chandelier"),
    ("8507", "Batteries", 28, "Electrical", "battery inverter ups lithium"),
    # Plumbing
    ("3917", "PVC pipes", 18, "Plumbing", "pvc pipe cpvc upvc conduit"),
    ("7412", "Copper fittings", 18, "Plumbing", "copper fitting pipe tube"),
    ("8481", "Taps valves", 18, "Plumbing", "tap valve cock faucet"),
    # Electronics
    ("8517", "Mobile phones", 18, "Electronics", "mobile phone smartphone"),
    ("8471", "Computers laptops", 18, "Electronics", "computer laptop desktop"),
    ("8528", "TVs monitors", 18, "Electronics", "tv television monitor led lcd"),
    ("8443", "Printers", 18, "Electronics", "printer scanner copier"),
    # Food & Grocery
    ("1006", "Rice", 5, "Food", "rice basmati chawal"),
    ("1001", "Wheat", 0, "Food", "wheat gehun atta flour"),
    ("1005", "Maize corn", 0, "Food", "maize corn makka"),
    ("0713", "Pulses dal", 0, "Food", "dal lentil pulse chana moong toor urad"),
    ("1507", "Cooking oil", 5, "Food", "oil cooking soybean groundnut sunflower mustard"),
    ("1701", "Sugar", 5, "Food", "sugar cheeni"),
    ("0402", "Milk products", 0, "Food", "milk doodh paneer curd ghee"),
    ("2106", "Namkeen snacks", 12, "Food", "namkeen bhujia chips snack"),
    ("1905", "Biscuits", 18, "Food", "biscuit cookie cake bread"),
    # Textiles
    ("6109", "T-shirts", 5, "Textile", "tshirt t-shirt knitted"),
    ("6203", "Mens clothing", 5, "Textile", "shirt pant trouser men"),
    ("6204", "Womens clothing", 5, "Textile", "saree suit kurti women dress"),
    ("5208", "Cotton fabric", 5, "Textile", "cotton fabric cloth kapda"),
    ("6305", "Packaging bags", 18, "Textile", "bag sack jute packaging"),
    # Automobile
    ("8711", "Motorcycles", 28, "Auto", "motorcycle bike scooter two wheeler"),
    ("8703", "Cars", 28, "Auto", "car vehicle sedan suv"),
    ("4011", "Tyres", 28, "Auto", "tyre tire tube rubber"),
    ("2710", "Petrol diesel", 0, "Fuel", "petrol diesel fuel petroleum"),
    # Medicines
    ("3004", "Medicines", 12, "Pharma", "medicine tablet capsule syrup drug"),
    ("3005", "Bandages", 18, "Pharma", "bandage dressing cotton surgical"),
    # Furniture
    ("9403", "Furniture", 18, "Furniture", "furniture table chair desk almirah"),
    ("4418", "Wooden items", 18, "Furniture", "wood door window frame ply plywood"),
    # Stationery
    ("4820", "Notebooks registers", 18, "Stationery", "notebook register book diary"),
    ("8214", "Stationery items", 18, "Stationery", "pen pencil eraser sharpener scale"),
    ("4819", "Paper packaging", 18, "Stationery", "paper box carton packaging"),
    # Services (SAC codes)
    ("9954", "Construction services", 18, "Service", "construction building contractor labour", True),
    ("9971", "Financial services", 18, "Service", "banking insurance financial", True),
    ("9963", "Accommodation hotel", 12, "Service", "hotel lodge accommodation room rent", True),
    ("9961", "Transport goods", 5, "Service", "transport freight logistics delivery shipping", True),
    ("9964", "Passenger transport", 5, "Service", "taxi cab auto travel passenger", True),
    ("9972", "Real estate", 18, "Service", "rent lease property real estate", True),
    ("9973", "Leasing rental", 18, "Service", "rental leasing equipment machinery", True),
    ("9983", "IT software services", 18, "Service", "software it computer development consulting", True),
    ("9985", "Support services", 18, "Service", "cleaning security maintenance housekeeping", True),
    ("9982", "Legal accounting", 18, "Service", "legal advocate ca chartered accountant audit", True),
    ("9981", "Telecom services", 18, "Service", "telecom mobile internet broadband recharge", True),
    ("9992", "Education", 0, "Service", "education school college tuition coaching", True),
    ("9993", "Healthcare", 0, "Service", "hospital doctor medical clinic health", True),
    ("9962", "Restaurant food", 5, "Service", "restaurant food catering canteen dhaba", True),
    ("9984", "Repair maintenance", 18, "Service", "repair maintenance service amc", True),
    ("9986", "Event management", 18, "Service", "event wedding catering decoration", True),
    ("9987", "Advertising", 18, "Service", "advertising marketing digital printing", True),
]


def seed():
    """Insert HSN codes into Supabase."""
    from app.database import get_db

    db = get_db()
    rows = []
    for code_tuple in HSN_CODES:
        is_service = len(code_tuple) > 5 and code_tuple[5] is True
        rows.append({
            "code": code_tuple[0],
            "description": code_tuple[1],
            "gst_rate": code_tuple[2],
            "category": code_tuple[3],
            "search_keywords": code_tuple[4],
            "is_service": is_service,
        })

    # Upsert in batches
    for i in range(0, len(rows), 20):
        batch = rows[i:i+20]
        db.table("hsn_codes").upsert(batch).execute()

    print(f"Seeded {len(rows)} HSN/SAC codes.")


if __name__ == "__main__":
    seed()
