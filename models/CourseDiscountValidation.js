// Shared discount validation helpers for course pricing.

const hasActiveDiscount = (price, discountPrice) => (
  Number.isFinite(price) &&
  price > 0 &&
  Number.isFinite(discountPrice) &&
  discountPrice > 0 &&
  discountPrice < price
);

const getEffectiveCoursePrice = (course) => {
  if (hasActiveDiscount(course.price, course.discountPrice)) {
    return course.discountPrice;
  }
  return course.price;
};

module.exports = { hasActiveDiscount, getEffectiveCoursePrice };
