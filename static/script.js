document.addEventListener('DOMContentLoaded', function() {
            // --- Common Elements (used across index.html, product_detail.html, admin_dashboard.html) ---
            const userAuthSection = document.getElementById('user-auth-section');
            const adminPanelNavItem = document.getElementById('admin-panel-nav-item');
            const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const cartCountElement = document.getElementById('cart-count');
            const cartItemsContainer = document.getElementById('cart-items-container');
            const cartTotalElement = document.getElementById('cart-total');
            const emptyCartMessage = document.getElementById('empty-cart-message');

            // --- Specific Elements for Index Page (will be null on other pages, hence the checks) ---
            const featuredProductsContainer = document.getElementById('featured-products-container');
            const dealsOfDayContainer = document.getElementById('deals-of-day-container');
            const dealsTimerElement = document.getElementById('deals-timer');

            // --- Specific Elements for Admin Dashboard Page (will be null on other pages, hence the checks) ---
            const addProductForm = document.getElementById('add-product-form');
            const adminProductTableBody = document.getElementById('admin-product-table-body');
            const adminProductCountElement = document.getElementById('admin-product-count');


            // --- Utility Functions (Common) ---

            function generateStarRating(rating) {
                let stars = '';
                for (let i = 0; i < 5; i++) {
                    if (rating - i >= 1) {
                        stars += '<i class="fas fa-star"></i>';
                    } else if (rating - i > 0) {
                        stars += '<i class="fas fa-star-half-alt"></i>';
                    } else {
                        stars += '<i class="far fa-star"></i>';
                    }
                }
                return stars;
            }

            // --- User Status & Navbar Update (Common) ---

            async function checkLoginStatus() {
                try {
                    const response = await fetch('/api/user_status');
                    const data = await response.json();

                    if (data.isLoggedIn) {
                        userAuthSection.innerHTML = `
                    <span class="text-white me-2">Welcome, ${data.username}!</span>
                    <a href="#" class="text-white" id="logout-link">LOGOUT</a>
                `;
                        document.getElementById('logout-link').addEventListener('click', handleLogout);

                        if (data.is_admin) {
                            adminPanelNavItem.classList.remove('d-none');
                        } else {
                            adminPanelNavItem.classList.add('d-none');
                        }
                    } else {
                        userAuthSection.innerHTML = `
                    <a href="#" class="text-white" data-bs-toggle="modal" data-bs-target="#loginModal">LOGIN</a>
                    <a href="#" class="text-white" data-bs-toggle="modal" data-bs-target="#registerModal">SIGN UP</a>
                `;
                        adminPanelNavItem.classList.add('d-none');
                    }
                    await fetchCartItems(); // Always fetch cart to update header count

                } catch (error) {
                    console.error('Error checking login status:', error);
                    userAuthSection.innerHTML = `
                <a href="#" class="text-white" data-bs-toggle="modal" data-bs-target="#loginModal">LOGIN</a>
                <a href="#" class="text-white" data-bs-toggle="modal" data-bs-target="#registerModal">SIGN UP</a>
            `;
                    adminPanelNavItem.classList.add('d-none');
                }
            }

            async function handleLogout(event) {
                event.preventDefault();
                try {
                    const response = await fetch('/api/logout', { method: 'POST' });
                    const result = await response.json();
                    if (response.ok && result.success) {
                        alert('Logged out successfully!');
                        window.location.href = '/'; // Redirect to home or refresh after logout
                    } else {
                        alert('Logout failed: ' + result.message);
                    }
                } catch (error) {
                    console.error('Error during logout:', error);
                    alert('An error occurred during logout. Please try again.');
                }
            }

            // --- Authentication Forms (Common) ---

            if (loginForm) {
                loginForm.addEventListener('submit', async function(event) {
                    event.preventDefault();
                    const email = document.getElementById('login-email').value;
                    const password = document.getElementById('login-password').value;

                    try {
                        const response = await fetch('/api/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: email, password: password })
                        });

                        const result = await response.json();
                        if (response.ok && result.success) {
                            alert('Login successful!');
                            loginModal.hide();
                            await checkLoginStatus(); // Update UI after login
                            // If on admin page, redirect or reload to apply admin access
                            if (window.location.pathname === '/admin' && result.user && result.user.is_admin) {
                                window.location.reload();
                            } else if (window.location.pathname === '/admin') {
                                // If tried to log into admin page as non-admin, redirect to home
                                window.location.href = '/';
                            }
                        } else {
                            alert('Login failed: ' + result.message);
                        }
                    } catch (error) {
                        console.error('Error during login:', error);
                        alert('An error occurred during login. Please try again.');
                    }
                });
            }

            if (registerForm) {
                registerForm.addEventListener('submit', async function(event) {
                    event.preventDefault();
                    const fullname = document.getElementById('register-fullname').value;
                    const email = document.getElementById('register-email').value;
                    const password = document.getElementById('register-password').value;
                    const confirmPassword = document.getElementById('register-confirm-password').value;

                    if (password !== confirmPassword) {
                        alert('Passwords do not match!');
                        return;
                    }

                    try {
                        const response = await fetch('/api/register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fullname: fullname, email: email, password: password })
                        });

                        const result = await response.json();
                        if (response.ok && result.success) {
                            alert('Registration successful! You can now log in.');
                            const loginTabButton = document.getElementById('login-tab');
                            if (loginTabButton) {
                                new bootstrap.Tab(loginTabButton).show();
                            }
                        } else {
                            alert('Registration failed: ' + result.message);
                        }
                    } catch (error) {
                        console.error('Error during registration:', error);
                        alert('An error occurred during registration. Please try again.');
                    }
                });
            }

            // Login/Register tabs functionality (common)
            const registerTab = document.querySelector('#register-tab');
            const loginTab = document.querySelector('#login-tab');

            if (registerTab && loginTab) {
                registerTab.addEventListener('click', function() {
                    new bootstrap.Tab(this).show();
                });
                loginTab.addEventListener('click', function() {
                    new bootstrap.Tab(this).show();
                });
            }

            // --- Cart Management (Common) ---

            // This function is now global or exposed so product_detail.js can call it
            window.addToCart = async function(product) {
                try {
                    const response = await fetch('/api/cart/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ product_id: product.id, quantity: product.quantity })
                    });
                    const result = await response.json();

                    if (response.ok && result.success) {
                        alert(`${product.name} added to cart!`);
                        await fetchCartItems(); // Re-fetch cart after adding
                    } else {
                        alert(`Failed to add ${product.name} to cart: ` + (result.message || 'Server error'));
                    }
                } catch (error) {
                    console.error('Error adding to cart:', error);
                    alert('An error occurred while adding to cart.');
                }
            }

            async function removeFromCart(productId) {
                try {
                    const response = await fetch('/api/cart/remove', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ product_id: productId })
                    });
                    const result = await response.json();

                    if (response.ok && result.success) {
                        alert('Item removed from cart.');
                        await fetchCartItems();
                    } else {
                        alert('Failed to remove item from cart: ' + (result.message || 'Server error'));
                    }
                } catch (error) {
                    console.error('Error removing from cart:', error);
                    alert('An error occurred while removing from cart.');
                }
            }

            async function fetchCartItems() {
                try {
                    const response = await fetch('/api/cart');
                    const data = await response.json();
                    if (response.ok && data.success) {
                        const cart = data.cart_items;
                        renderCartItems(cart);
                    } else {
                        console.error('Failed to fetch cart items:', data.message);
                        renderCartItems([]); // Render empty cart on error
                    }
                } catch (error) {
                    console.error('Error fetching cart items:', error);
                    renderCartItems([]);
                }
            }

            function renderCartItems(cartItems) {
                cartItemsContainer.innerHTML = '';
                let total = 0;

                if (cartItems.length === 0) {
                    emptyCartMessage.classList.remove('d-none');
                    cartCountElement.textContent = '0';
                    cartTotalElement.textContent = 'PKR 0';
                    return;
                } else {
                    emptyCartMessage.classList.add('d-none');
                }

                cartItems.forEach(item => {
                    const itemTotal = item.price * item.quantity;
                    total += itemTotal;
                    const cartItemHtml = `
                <div class="d-flex align-items-center mb-3 border-bottom pb-3">
                    <img src="${item.image_url}" alt="${item.name}" style="width: 80px; height: 80px; object-fit: cover; margin-right: 15px;" onerror="this.onerror=null;this.src='/static/images/no-image.webp';">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${item.name}</h6>
                        <p class="mb-0 text-muted">Price: PKR ${item.price.toLocaleString()} x ${item.quantity}</p>
                        <p class="mb-0 fw-bold">Subtotal: PKR ${itemTotal.toLocaleString()}</p>
                    </div>
                    <button class="btn btn-sm btn-outline-danger remove-from-cart" data-product-id="${item.product_id}">Remove</button>
                </div>
            `;
                    cartItemsContainer.insertAdjacentHTML('beforeend', cartItemHtml);
                });

                cartCountElement.textContent = cartItems.length;
                cartTotalElement.textContent = `PKR ${total.toLocaleString()}`;

                document.querySelectorAll('.remove-from-cart').forEach(button => {
                    button.addEventListener('click', function() {
                        const productId = this.dataset.productId;
                        removeFromCart(productId);
                    });
                });
            }

            // --- Product Rendering (Index Page Specific) ---
            // This block only runs if `featuredProductsContainer` and `dealsOfDayContainer` exist (i.e., on index.html)
            if (featuredProductsContainer && dealsOfDayContainer) {
                function renderProductCards(products, container) {
                    container.innerHTML = ''; // Clear existing content
                    if (products.length === 0) {
                        container.innerHTML = '<p class="text-muted text-center">No products available in this section.</p>';
                        return;
                    }
                    products.forEach(product => {
                                const productCardHtml = `
                    <div class="col-xl-3 col-lg-4 col-md-6 mb-4">
                        <div class="product-card" data-product-id="${product.id}">
                            <div class="product-img">
                                <img src="${product.image_url}" alt="${product.name}" onerror="this.onerror=null;this.src='/static/images/no-image.webp';">
                            </div>
                            <div class="product-body">
                                <a href="/product/${product.id}" class="product-title-link">
                                    <div class="product-title">${product.name}</div>
                                </a>
                                <div class="product-price">PKR ${product.price.toLocaleString()} 
                                    ${product.original_price && product.original_price > product.price ? `<span class="original-price">PKR ${product.original_price.toLocaleString()}</span>` : ''}
                                </div>
                                <div class="product-rating">
                                    ${generateStarRating(product.rating)}
                                    <span class="ms-1">(${product.reviews})</span>
                                </div>
                                <button class="add-to-cart">Add to Cart</button>
                            </div>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', productCardHtml);
            });

            // Add event listeners for "Add to Cart" buttons on newly rendered cards
            container.querySelectorAll('.add-to-cart').forEach(button => {
                button.addEventListener('click', function() {
                    const productCard = this.closest('.product-card');
                    const productId = productCard.dataset.productId;
                    const productName = productCard.querySelector('.product-title').textContent;
                    // Extract price robustly, considering original price might be present
                    const priceText = productCard.querySelector('.product-price').textContent;
                    const priceMatch = priceText.match(/PKR ([\d,\.]+)/);
                    const productPrice = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
                    const productImageUrl = productCard.querySelector('.product-img img').src;

                    window.addToCart({ // Use the global addToCart function
                        id: productId,
                        name: productName,
                        price: productPrice,
                        image_url: productImageUrl,
                        quantity: 1
                    });
                });
            });
        }

        async function fetchProducts() {
            try {
                const response = await fetch('/api/products');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const products = await response.json();
                
                // Assuming you want some products as featured and some as deals
                // Adjust slicing as needed, or add a 'is_featured' flag to products
                renderProductCards(products.slice(0, 4), featuredProductsContainer);
                renderProductCards(products.slice(4, 8), dealsOfDayContainer);
            } catch (error) {
                console.error('Error fetching products:', error);
                if (featuredProductsContainer) featuredProductsContainer.innerHTML = '<p class="text-danger text-center">Failed to load featured products.</p>';
                if (dealsOfDayContainer) dealsOfDayContainer.innerHTML = '<p class="text-danger text-center">Failed to load deals of the day.</p>';
            }
        }

        function startDealsTimer(durationInSeconds) {
            let timer = durationInSeconds;
            // Clear any existing interval to prevent multiple timers if script reloads
            if (window.dealsTimerInterval) {
                clearInterval(window.dealsTimerInterval);
            }

            window.dealsTimerInterval = setInterval(function () {
                let hours = parseInt(timer / 3600, 10);
                let minutes = parseInt((timer % 3600) / 60, 10);
                let seconds = parseInt(timer % 60, 10);

                hours = hours < 10 ? "0" + hours : hours;
                minutes = minutes < 10 ? "0" + minutes : minutes;
                seconds = seconds < 10 ? "0" + seconds : seconds;

                if (dealsTimerElement) {
                    dealsTimerElement.textContent = hours + ":" + minutes + ":" + seconds;
                }

                if (--timer < 0) {
                    clearInterval(window.dealsTimerInterval);
                    if (dealsTimerElement) {
                        dealsTimerElement.textContent = "EXPIRED";
                    }
                }
            }, 1000);
        }

        // Initialize Index Page Specific functions
        fetchProducts();
        startDealsTimer(7200); // 2 hours
    }


    // --- Admin Dashboard Specific (Only runs if on admin_dashboard.html) ---
    // This block only runs if `addProductForm` and `adminProductTableBody` exist
    if (addProductForm && adminProductTableBody) {
        async function fetchAdminProducts() {
            try {
                const response = await fetch('/api/products');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const products = await response.json();
                renderAdminProductTable(products);
                if (adminProductCountElement) {
                    adminProductCountElement.textContent = products.length;
                }
            } catch (error) {
                console.error('Error fetching admin products:', error);
                adminProductTableBody.innerHTML = '<tr><td colspan="7" class="text-danger text-center">Failed to load products.</td></tr>';
                if (adminProductCountElement) {
                    adminProductCountElement.textContent = 'Error';
                }
            }
        }

        function renderAdminProductTable(products) {
            adminProductTableBody.innerHTML = '';
            if (products.length === 0) {
                adminProductTableBody.innerHTML = '<tr><td colspan="7" class="text-muted text-center">No products found.</td></tr>';
                return;
            }
            products.forEach(product => {
                const rowHtml = `
                    <tr>
                        <td><img src="${product.image_url}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover;" onerror="this.onerror=null;this.src='/static/images/no-image.webp';"></td>
                        <td>${product.name}</td>
                        <td>${product.category}</td>
                        <td>PKR ${product.price.toLocaleString()}</td>
                        <td>In Stock</td> <td>Active</td> <td>
                            <button class="btn btn-sm btn-info me-1"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-danger delete-product-btn" data-product-id="${product.id}"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
                adminProductTableBody.insertAdjacentHTML('beforeend', rowHtml);
            });

            // Add event listeners for delete buttons
            document.querySelectorAll('.delete-product-btn').forEach(button => {
                button.addEventListener('click', async function() {
                    const productIdToDelete = this.dataset.productId;
                    if (confirm('Are you sure you want to delete this product?')) {
                        try {
                            const response = await fetch(`/api/products/${productIdToDelete}`, {
                                method: 'DELETE'
                            });
                            const result = await response.json();
                            if (response.ok && result.success) {
                                alert('Product deleted successfully!');
                                fetchAdminProducts(); // Refresh the product list
                            } else {
                                alert('Failed to delete product: ' + (result.message || 'Server error'));
                            }
                        } catch (error) {
                            console.error('Error deleting product:', error);
                            alert('An error occurred while deleting the product.');
                        }
                    }
                });
            });
        }

        addProductForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const newProduct = {
                name: document.getElementById('product-name').value,
                category: document.getElementById('product-category').value,
                price: parseFloat(document.getElementById('product-price').value),
                original_price: document.getElementById('product-original-price').value ? parseFloat(document.getElementById('product-original-price').value) : null,
                rating: parseFloat(document.getElementById('product-rating').value),
                reviews: parseInt(document.getElementById('product-reviews').value),
                description: document.getElementById('product-description').value,
                image_url: document.getElementById('product-image-url').value
            };

            try {
                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProduct)
                });

                const result = await response.json();
                if (response.ok && result.success) {
                    alert('Product added successfully!');
                    addProductForm.reset();
                    fetchAdminProducts(); // Refresh the admin product list
                    // Optional: Collapse the add product form after submission
                    const addProductFormCollapse = document.getElementById('add-product-form-tab'); // This is the tab-pane ID
                    if (addProductFormCollapse) {
                         const bsCollapse = bootstrap.Tab.getInstance(document.querySelector('[href="#admin-products-list"]')) || new bootstrap.Tab(document.querySelector('[href="#admin-products-list"]'));
                         bsCollapse.show(); // Switch back to products list tab
                    }
                } else {
                    alert('Failed to add product: ' + (result.message || 'Server error'));
                }
            } catch (error) {
                console.error('Error adding product:', error);
                alert('An error occurred while adding the product. Please try again.');
            }
        });

        // Initialize Admin Dashboard specific functions
        fetchAdminProducts();

        // Handle tab switching for admin panel
        document.querySelectorAll('.sidebar .nav-link[data-bs-toggle="tab"]').forEach(tabTrigger => {
            tabTrigger.addEventListener('click', function(event) {
                event.preventDefault();
                new bootstrap.Tab(this).show();
                // Update active state in sidebar (optional, Bootstrap usually handles data-bs-toggle="tab")
                document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }

    // --- Global Initializations ---
    checkLoginStatus(); // Always check login status on page load
});