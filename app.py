from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
import uuid # For generating unique product IDs

app = Flask(__name__)
app.secret_key = 'your_secret_key_here' # IMPORTANT: Replace with a strong, random secret key in production

DATABASE = 'database.db'
UPLOAD_FOLDER = 'static/uploads' # For product images if you implement file uploads
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row # This allows accessing columns by name
    return conn

def init_db_if_needed():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create users table if it doesn't exist, including is_admin
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullname TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            is_admin BOOLEAN NOT NULL DEFAULT 0
        )
    ''')

    # Create products table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            original_price REAL,
            category TEXT,
            image_url TEXT,
            rating REAL DEFAULT 0.0,
            reviews INTEGER DEFAULT 0
        )
    ''')

    # Create cart_items table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cart_items (
            user_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (product_id) REFERENCES products (id),
            PRIMARY KEY (user_id, product_id)
        )
    ''')

    conn.commit()

    # Insert a default admin user if no users exist
    cursor.execute("SELECT COUNT(*) FROM users WHERE is_admin = 1")
    if cursor.fetchone()[0] == 0:
        admin_password_hash = generate_password_hash("adminpass")
        cursor.execute(
            "INSERT INTO users (fullname, email, password, is_admin) VALUES (?, ?, ?, ?)",
            ("Admin User", "admin@example.com", admin_password_hash, 1)
        )
        conn.commit()
        print("Inserting default admin user (admin@example.com / adminpass)...")

    conn.close()

# --- Routes for serving HTML files ---

@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')

@app.route('/product/<product_id>')
def product_detail(product_id):
    # We don't fetch product data here, the JS on the page will do that
    # We just ensure the HTML template exists
    if os.path.exists(os.path.join(app.root_path, 'templates', 'product_detail.html')):
        return send_from_directory('templates', 'product_detail.html')
    return "Product detail page template not found", 404


@app.route('/admin')
def admin_dashboard():
    # Basic check: Only allow access if user is logged in and is_admin
    if 'user_id' not in session or not session.get('is_admin'):
        # Redirect to login or show an access denied message
        return "Access Denied: You must be an administrator to view this page.", 403
    return send_from_directory('templates', 'admin_dashboard.html')

# NEW ROUTES FOR ABOUT US AND CONTACT
@app.route('/about')
def about_us():
    return send_from_directory('templates', 'about_us.html')

@app.route('/contact')
def contact_us():
    return send_from_directory('templates', 'contact_us.html')


@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

# --- API Routes ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    fullname = data.get('fullname')
    email = data.get('email')
    password = data.get('password')

    if not all([fullname, email, password]):
        return jsonify({'success': False, 'message': 'All fields are required!'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        hashed_password = generate_password_hash(password)
        cursor.execute("INSERT INTO users (fullname, email, password, is_admin) VALUES (?, ?, ?, ?)",
                       (fullname, email, hashed_password, 0)) # Default new users to not admin
        conn.commit()
        return jsonify({'success': True, 'message': 'Registration successful!'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Email already registered.'}), 409
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return jsonify({'success': False, 'message': 'Email and password are required!'}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if user and check_password_hash(user['password'], password):
        session['user_id'] = user['id']
        session['username'] = user['fullname']
        session['is_admin'] = bool(user['is_admin']) # Store admin status in session
        return jsonify({
            'success': True,
            'message': 'Login successful!',
            'user': {
                'id': user['id'],
                'fullname': user['fullname'],
                'email': user['email'],
                'is_admin': bool(user['is_admin'])
            }
        }), 200
    else:
        return jsonify({'success': False, 'message': 'Invalid email or password.'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    session.pop('is_admin', None)
    return jsonify({'success': True, 'message': 'Logged out successfully.'}), 200

@app.route('/api/user_status', methods=['GET'])
def user_status():
    if 'user_id' in session:
        return jsonify({
            'isLoggedIn': True,
            'username': session.get('username'),
            'is_admin': session.get('is_admin', False)
        }), 200
    else:
        return jsonify({'isLoggedIn': False}), 200

@app.route('/api/products', methods=['GET', 'POST'])
def products():
    conn = get_db_connection()
    if request.method == 'GET':
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM products")
        products_data = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(products_data)
    elif request.method == 'POST':
        # Admin check for POST request
        if 'user_id' not in session or not session.get('is_admin'):
            conn.close()
            return jsonify({'success': False, 'message': 'Unauthorized: Admin access required.'}), 403

        data = request.get_json()
        name = data.get('name')
        description = data.get('description', '')
        price = data.get('price')
        original_price = data.get('original_price')
        category = data.get('category', 'General')
        image_url = data.get('image_url', '/static/images/no-image.webp') # Default image
        rating = data.get('rating', 0.0)
        reviews = data.get('reviews', 0)

        if not all([name, price]):
            conn.close()
            return jsonify({'success': False, 'message': 'Name and price are required for a product.'}), 400

        product_id = str(uuid.uuid4()) # Generate a unique ID for the product

        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO products (id, name, description, price, original_price, category, image_url, rating, reviews) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (product_id, name, description, price, original_price, category, image_url, rating, reviews)
            )
            conn.commit()
            return jsonify({'success': True, 'message': 'Product added successfully!', 'product_id': product_id}), 201
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500
        finally:
            conn.close()

@app.route('/api/products/<product_id>', methods=['GET', 'PUT', 'DELETE'])
def product_by_id(product_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'GET':
        product = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
        conn.close()
        if product:
            return jsonify(dict(product)) # Convert row to dictionary
        return jsonify({'success': False, 'message': 'Product not found.'}), 404

    # Admin checks for PUT and DELETE
    if 'user_id' not in session or not session.get('is_admin'):
        conn.close()
        return jsonify({'success': False, 'message': 'Unauthorized: Admin access required.'}), 403

    if request.method == 'PUT':
        data = request.get_json()
        updates = {k: v for k, v in data.items() if k in ['name', 'description', 'price', 'original_price', 'category', 'image_url', 'rating', 'reviews']}
        
        if not updates:
            conn.close()
            return jsonify({'success': False, 'message': 'No valid fields provided for update.'}), 400
        
        set_clause = ', '.join([f"{key} = ?" for key in updates.keys()])
        values = list(updates.values())
        values.append(product_id) # Add product_id for the WHERE clause

        try:
            cursor.execute(f"UPDATE products SET {set_clause} WHERE id = ?", values)
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({'success': False, 'message': 'Product not found or no changes made.'}), 404
            return jsonify({'success': True, 'message': 'Product updated successfully.'}), 200
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500
        finally:
            conn.close()

    elif request.method == 'DELETE':
        try:
            cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
            conn.commit()
            if cursor.rowcount == 0:
                return jsonify({'success': False, 'message': 'Product not found.'}), 404
            return jsonify({'success': True, 'message': 'Product deleted successfully.'}), 200
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': str(e)}), 500
        finally:
            conn.close()

@app.route('/api/cart', methods=['GET'])
def get_cart():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'User not logged in.'}), 401

    user_id = session['user_id']
    conn = get_db_connection()
    try:
        # Join cart_items with products to get product details
        cursor = conn.execute('''
            SELECT ci.product_id, ci.quantity, p.name, p.price, p.image_url
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = ?
        ''', (user_id,))
        cart_items = [dict(row) for row in cursor.fetchall()]
        return jsonify({'success': True, 'cart_items': cart_items}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/cart/add', methods=['POST'])
def add_to_cart():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'User not logged in.'}), 401

    data = request.get_json()
    product_id = data.get('product_id')
    quantity = data.get('quantity', 1)

    if not product_id:
        return jsonify({'success': False, 'message': 'Product ID is required.'}), 400
    if not isinstance(quantity, int) or quantity <= 0:
        return jsonify({'success': False, 'message': 'Quantity must be a positive integer.'}), 400

    user_id = session['user_id']
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Check if product exists
        product = conn.execute('SELECT id FROM products WHERE id = ?', (product_id,)).fetchone()
        if not product:
            return jsonify({'success': False, 'message': 'Product not found.'}), 404

        # Check if item already in cart
        existing_item = cursor.execute(
            'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
            (user_id, product_id)
        ).fetchone()

        if existing_item:
            # Update quantity
            new_quantity = existing_item['quantity'] + quantity
            cursor.execute(
                'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?',
                (new_quantity, user_id, product_id)
            )
        else:
            # Insert new item
            cursor.execute(
                'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
                (user_id, product_id, quantity)
            )
        conn.commit()
        return jsonify({'success': True, 'message': 'Item added to cart.'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/cart/remove', methods=['POST'])
def remove_from_cart():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'User not logged in.'}), 401

    data = request.get_json()
    product_id = data.get('product_id')

    if not product_id:
        return jsonify({'success': False, 'message': 'Product ID is required.'}), 400

    user_id = session['user_id']
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
            (user_id, product_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'success': False, 'message': 'Item not found in cart.'}), 404
        return jsonify({'success': True, 'message': 'Item removed from cart.'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    init_db_if_needed() # Ensure database is set up
    app.run(debug=True)