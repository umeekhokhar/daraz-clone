document.addEventListener('DOMContentLoaded', function() {
    // --- Elements for Product Detail Page ---
    const productPageTitle = document.getElementById('product-page-title');
    const productMainImage = document.getElementById('product-main-image');
    const productNameElement = document.getElementById('product-name');
    const productPriceElement = document.getElementById('product-price');
    const productOriginalPriceElement = document.getElementById('product-original-price');
    const productRatingElement = document.getElementById('product-rating');
    const productReviewsElement = document.getElementById('product-reviews');
    const productDescriptionElement = document.getElementById('product-description');
    const productQuantityInput = document.getElementById('product-quantity');
    const decreaseQuantityButton = document.getElementById('decrease-quantity');
    const increaseQuantityButton = document.getElementById('increase-quantity');
    const addToCartButton = document.getElementById('add-to-cart-button');
    const reviewsContainer = document.getElementById('reviews-container');
    const noReviewsMessage = document.getElementById('no-reviews-message');
    const totalReviewsCountElement = document.getElementById('total-reviews-count');

    // --- Utility Functions (Duplicated from script.js for standalone use, or could be imported/shared) ---
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

    // --- Product Detail Fetching and Rendering ---

    async function fetchProductDetails() {
        // Extract product ID from the URL (e.g., /product/YOUR_PRODUCT_ID)
        const pathSegments = window.location.pathname.split('/');
        const productId = pathSegments[pathSegments.length - 1];

        if (!productId) {
            productNameElement.textContent = 'Error: Product ID not found in URL.';
            return;
        }

        try {
            const response = await fetch(`/api/products/${productId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const product = await response.json();
            renderProductDetails(product);
        } catch (error) {
            console.error('Error fetching product details:', error);
            productNameElement.textContent = 'Product Not Found';
            productDescriptionElement.textContent = 'The product you are looking for does not exist or an error occurred.';
            // Hide other elements or set to default
            productPriceElement.textContent = '';
            productOriginalPriceElement.style.display = 'none';
            productRatingElement.innerHTML = '';
            productReviewsElement.textContent = '';
            productMainImage.src = '/static/images/no-image.webp';
            addToCartButton.disabled = true;
            decreaseQuantityButton.disabled = true;
            increaseQuantityButton.disabled = true;
            productQuantityInput.disabled = true;
        }
    }

    function renderProductDetails(product) {
        productPageTitle.textContent = `${product.name} - Daraz Clone`;
        productMainImage.src = product.image_url || '/static/images/no-image.webp';
        productMainImage.alt = product.name;
        productNameElement.textContent = product.name;
        productPriceElement.textContent = `PKR ${product.price.toLocaleString()}`;

        if (product.original_price && product.original_price > product.price) {
            productOriginalPriceElement.textContent = `PKR ${product.original_price.toLocaleString()}`;
            productOriginalPriceElement.style.display = 'inline';
        } else {
            productOriginalPriceElement.style.display = 'none';
        }

        productRatingElement.innerHTML = generateStarRating(product.rating);
        productReviewsElement.textContent = `(${product.reviews} reviews)`;
        productDescriptionElement.textContent = product.description || 'No description available.';

        // Dummy reviews for display
        const dummyReviews = [
            { name: "Ali Khan", date: "2023-10-26", rating: 5, comment: "Excellent product, exactly as described! Fast delivery." },
            { name: "Sara Ahmed", date: "2023-11-15", rating: 4, comment: "Good quality for the price. Happy with my purchase." },
            { name: "Usman Tariq", date: "2023-12-01", rating: 3, comment: "It's okay, but the color was slightly different than expected." }
        ];

        renderReviews(dummyReviews);
    }

    function renderReviews(reviews) {
        reviewsContainer.innerHTML = '';
        if (reviews.length === 0) {
            noReviewsMessage.classList.remove('d-none');
            totalReviewsCountElement.textContent = '0';
        } else {
            noReviewsMessage.classList.add('d-none');
            totalReviewsCountElement.textContent = reviews.length;
            reviews.forEach(review => {
                const reviewHtml = `
                    <div class="review-item">
                        <div class="d-flex align-items-center mb-2">
                            <span class="reviewer-name">${review.name}</span>
                            <span class="review-date">${review.date}</span>
                        </div>
                        <div class="review-rating mb-2">
                            ${generateStarRating(review.rating)}
                        </div>
                        <p class="review-comment">${review.comment}</p>
                    </div>
                `;
                reviewsContainer.insertAdjacentHTML('beforeend', reviewHtml);
            });
        }
    }

    // --- Quantity Selector Logic ---
    if (productQuantityInput) {
        decreaseQuantityButton.addEventListener('click', () => {
            let currentQuantity = parseInt(productQuantityInput.value);
            if (currentQuantity > 1) {
                productQuantityInput.value = currentQuantity - 1;
            }
        });

        increaseQuantityButton.addEventListener('click', () => {
            let currentQuantity = parseInt(productQuantityInput.value);
            productQuantityInput.value = currentQuantity + 1;
        });

        productQuantityInput.addEventListener('change', () => {
            let currentQuantity = parseInt(productQuantityInput.value);
            if (isNaN(currentQuantity) || currentQuantity < 1) {
                productQuantityInput.value = 1;
            }
        });
    }

    // --- Add to Cart Button Logic ---
    if (addToCartButton) {
        addToCartButton.addEventListener('click', async function() {
            const pathSegments = window.location.pathname.split('/');
            const productId = pathSegments[pathSegments.length - 1];
            const quantity = parseInt(productQuantityInput.value);

            if (!productId || isNaN(quantity) || quantity <= 0) {
                alert('Invalid product or quantity.');
                return;
            }

            try {
                const response = await fetch('/api/cart/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_id: productId, quantity: quantity })
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    alert(`Added ${quantity} item(s) to cart!`);
                    // Optionally, update cart count in header if script.js's fetchCartItems is global
                    if (typeof fetchCartItems === 'function') { // Check if common cart function exists
                        fetchCartItems();
                    }
                } else {
                    alert(`Failed to add to cart: ` + (result.message || 'Server error'));
                }
            } catch (error) {
                console.error('Error adding to cart:', error);
                alert('An error occurred while adding to cart.');
            }
        });
    }

    // --- Initialize Product Detail Page ---
    fetchProductDetails();
});