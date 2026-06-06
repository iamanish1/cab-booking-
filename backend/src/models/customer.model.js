const mongoose = require("mongoose");
const { CUSTOMER_STATUS } = require("../config/constants");

const customerSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, default: "" },
    city: { type: String, default: "" },
    defaultArea: { type: String, default: "" },
    status: {
      type: String,
      enum: Object.values(CUSTOMER_STATUS),
      default: CUSTOMER_STATUS.ACTIVE,
    },
    lastLoginAt: { type: Date, default: null },
    expoPushToken: { type: String, default: null },
  },
  { timestamps: true }
);

const Customer = mongoose.model("Customer", customerSchema);

module.exports = { Customer };
