"""Meal templates grouped by region with base prices and ingredients."""

VIETNAMESE_MEALS = {
    "breakfast": [
        {"name": "Bánh mì trứng", "cost": 20000, "desc": "Bánh mì with egg & pâté", "ingredients": ["Bread", "Egg", "Pate", "Vegetables"]},
        {"name": "Phở bò", "cost": 45000, "desc": "Beef pho noodle soup", "ingredients": ["Rice noodles", "Beef", "Broth", "Herbs"]},
        {"name": "Bún bò Huế", "cost": 40000, "desc": "Hue-style spicy noodle soup", "ingredients": ["Noodles", "Beef", "Pork", "Spices"]},
        {"name": "Xôi gà", "cost": 25000, "desc": "Sticky rice with chicken", "ingredients": ["Sticky rice", "Chicken", "Fried onion"]},
        {"name": "Cháo gà", "cost": 25000, "desc": "Chicken rice porridge", "ingredients": ["Rice", "Chicken", "Ginger", "Herbs"]},
        {"name": "Bánh cuốn", "cost": 30000, "desc": "Steamed rice rolls", "ingredients": ["Rice sheet", "Minced pork", "Mushroom"]},
        {"name": "Bún chả", "cost": 40000, "desc": "Grilled pork with noodles", "ingredients": ["Noodles", "Pork", "Fish sauce", "Herbs"]},
    ],
    "lunch": [
        {"name": "Cơm tấm sườn", "cost": 45000, "desc": "Broken rice with grilled pork", "ingredients": ["Broken rice", "Pork chop", "Pickles"]},
        {"name": "Bún thịt nướng", "cost": 40000, "desc": "Vermicelli with grilled meat", "ingredients": ["Vermicelli", "Pork", "Peanuts", "Herbs"]},
        {"name": "Cơm gà xối mỡ", "cost": 45000, "desc": "Crispy chicken rice", "ingredients": ["Rice", "Chicken", "Sauce", "Salad"]},
        {"name": "Mì Quảng", "cost": 35000, "desc": "Quang noodles", "ingredients": ["Noodles", "Shrimp", "Pork", "Peanut"]},
        {"name": "Cơm văn phòng", "cost": 35000, "desc": "Office lunch set", "ingredients": ["Rice", "Protein", "Vegetables", "Soup"]},
        {"name": "Hủ tiếu Nam Vang", "cost": 40000, "desc": "Phnom Penh noodle soup", "ingredients": ["Noodles", "Pork", "Shrimp", "Broth"]},
        {"name": "Bún riêu cua", "cost": 35000, "desc": "Crab noodle soup", "ingredients": ["Noodles", "Crab paste", "Tomato", "Herbs"]},
    ],
    "dinner": [
        {"name": "Cơm nhà (4 người)", "cost": 150000, "desc": "Rice, fish, vegetables, soup", "ingredients": ["Rice", "Fish", "Leafy greens", "Soup ingredients"]},
        {"name": "Cơm nhà (4 người)", "cost": 120000, "desc": "Rice, braised pork, morning glory, broth", "ingredients": ["Rice", "Pork", "Morning glory", "Broth"]},
        {"name": "Cơm nhà (4 người)", "cost": 180000, "desc": "Rice, grilled chicken, tofu, salad", "ingredients": ["Rice", "Chicken", "Tofu", "Vegetables"]},
        {"name": "Cơm nhà (4 người)", "cost": 130000, "desc": "Rice, eggs, stir-fried vegetables, soup", "ingredients": ["Rice", "Eggs", "Vegetables", "Soup"]},
        {"name": "Cơm nhà (4 người)", "cost": 160000, "desc": "Rice, steamed fish, beans, pumpkin soup", "ingredients": ["Rice", "Fish", "Beans", "Pumpkin"]},
        {"name": "Cơm nhà (4 người)", "cost": 140000, "desc": "Rice, pork belly, bitter melon, broth", "ingredients": ["Rice", "Pork belly", "Bitter melon", "Broth"]},
        {"name": "Cơm nhà (4 người)", "cost": 170000, "desc": "Rice, beef stew, greens, fruit", "ingredients": ["Rice", "Beef", "Leafy greens", "Fruit"]},
    ],
}

WESTERN_MEALS = {
    "breakfast": [
        {"name": "Oatmeal Bowl", "cost": 60000, "desc": "Oats, berries, yogurt", "ingredients": ["Oats", "Berries", "Yogurt", "Honey"]},
        {"name": "Scrambled Eggs Toast", "cost": 70000, "desc": "Eggs with whole-grain toast", "ingredients": ["Eggs", "Bread", "Butter", "Salad"]},
        {"name": "Bagel & Cream Cheese", "cost": 75000, "desc": "Classic morning combo", "ingredients": ["Bagel", "Cream cheese", "Fruit"]},
        {"name": "Greek Yogurt Parfait", "cost": 68000, "desc": "Protein-rich parfait", "ingredients": ["Yogurt", "Granola", "Banana"]},
        {"name": "Pancake Set", "cost": 85000, "desc": "Pancakes and fruit", "ingredients": ["Flour", "Milk", "Eggs", "Syrup"]},
    ],
    "lunch": [
        {"name": "Chicken Salad Bowl", "cost": 120000, "desc": "Chicken breast with mixed greens", "ingredients": ["Chicken", "Lettuce", "Tomato", "Olive oil"]},
        {"name": "Turkey Sandwich", "cost": 110000, "desc": "Whole grain sandwich", "ingredients": ["Bread", "Turkey", "Cheese", "Vegetables"]},
        {"name": "Pasta Marinara", "cost": 130000, "desc": "Tomato basil pasta", "ingredients": ["Pasta", "Tomato", "Basil", "Parmesan"]},
        {"name": "Sushi Bento", "cost": 150000, "desc": "Rice + fish + greens", "ingredients": ["Rice", "Fish", "Seaweed", "Vegetables"]},
        {"name": "Taco Bowl", "cost": 125000, "desc": "Beans, protein, rice", "ingredients": ["Rice", "Beans", "Beef", "Salsa"]},
    ],
    "dinner": [
        {"name": "Home Dinner (4 people)", "cost": 420000, "desc": "Grilled salmon, vegetables, soup", "ingredients": ["Salmon", "Potatoes", "Vegetables", "Soup"]},
        {"name": "Home Dinner (4 people)", "cost": 390000, "desc": "Roast chicken, salad, pasta", "ingredients": ["Chicken", "Salad", "Pasta", "Bread"]},
        {"name": "Home Dinner (4 people)", "cost": 450000, "desc": "Beef stew and whole grain rice", "ingredients": ["Beef", "Carrot", "Rice", "Broth"]},
        {"name": "Home Dinner (4 people)", "cost": 370000, "desc": "Pork chops, corn, greens", "ingredients": ["Pork", "Corn", "Greens", "Soup"]},
        {"name": "Home Dinner (4 people)", "cost": 410000, "desc": "Tofu stir-fry and soup", "ingredients": ["Tofu", "Vegetables", "Rice", "Soup"]},
    ],
}

LATAM_MEALS = {
    "breakfast": [
        {"name": "Arepa con queso", "cost": 45000, "desc": "Arepa con queso fresco", "ingredients": ["Harina de maiz", "Queso", "Mantequilla"]},
        {"name": "Tostada con huevo", "cost": 42000, "desc": "Pan tostado y huevo", "ingredients": ["Pan", "Huevo", "Tomate"]},
        {"name": "Avena y fruta", "cost": 40000, "desc": "Avena con banana", "ingredients": ["Avena", "Leche", "Banana"]},
        {"name": "Chilaquiles", "cost": 55000, "desc": "Totopos con salsa", "ingredients": ["Tortilla", "Salsa", "Queso"]},
        {"name": "Empanada y cafe", "cost": 48000, "desc": "Desayuno rapido", "ingredients": ["Harina", "Carne", "Cafe"]},
    ],
    "lunch": [
        {"name": "Pollo a la plancha", "cost": 85000, "desc": "Pollo con arroz y ensalada", "ingredients": ["Pollo", "Arroz", "Verduras"]},
        {"name": "Taco plate", "cost": 90000, "desc": "Tacos con frijoles", "ingredients": ["Tortilla", "Carne", "Frijoles"]},
        {"name": "Arroz con mariscos", "cost": 98000, "desc": "Arroz de mariscos", "ingredients": ["Arroz", "Mariscos", "Aji"]},
        {"name": "Burrito bowl", "cost": 93000, "desc": "Bowl con proteina", "ingredients": ["Arroz", "Frijoles", "Carne", "Salsa"]},
        {"name": "Sopa + sandwich", "cost": 76000, "desc": "Menu ligero", "ingredients": ["Pan", "Queso", "Sopa"]},
    ],
    "dinner": [
        {"name": "Cena casera (4 personas)", "cost": 260000, "desc": "Arroz, pollo, ensalada, sopa", "ingredients": ["Arroz", "Pollo", "Verduras", "Sopa"]},
        {"name": "Cena casera (4 personas)", "cost": 280000, "desc": "Pescado al horno y vegetales", "ingredients": ["Pescado", "Papas", "Verduras"]},
        {"name": "Cena casera (4 personas)", "cost": 240000, "desc": "Lentejas con carne", "ingredients": ["Lentejas", "Carne", "Arroz"]},
        {"name": "Cena casera (4 personas)", "cost": 270000, "desc": "Tortilla, carne y ensalada", "ingredients": ["Tortilla", "Carne", "Verduras"]},
        {"name": "Cena casera (4 personas)", "cost": 250000, "desc": "Pasta y verduras", "ingredients": ["Pasta", "Salsa", "Verduras"]},
    ],
}

MEAL_LIBRARY_BY_REGION = {
    "asia": VIETNAMESE_MEALS,
    "western": WESTERN_MEALS,
    "latam": LATAM_MEALS,
}
