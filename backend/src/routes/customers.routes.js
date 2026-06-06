const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../lib/async-handler");
const { ok } = require("../lib/http");
const { Customer } = require("../models/customer.model");
const { createOrUpdateCustomerProfile } = require("../services/customer.service");
const { getAppBootstrap } = require("../services/bootstrap.service");

function createCustomersRouter() {
  const router = express.Router();

  router.use(requireAuth("customer"));

  router.get(
    "/me",
    asyncHandler(async (req, res) => {
      const customer = await Customer.findById(req.auth.sub).lean();
      ok(res, customer);
    })
  );

  router.patch(
    "/me",
    asyncHandler(async (req, res) => {
      const current = await Customer.findById(req.auth.sub).lean();
      const customer = await createOrUpdateCustomerProfile({
        mobile: current.mobile,
        fullName: req.body.fullName ?? current.fullName,
        city: req.body.city ?? current.city,
        defaultArea: req.body.defaultArea ?? current.defaultArea,
      });
      ok(res, customer);
    })
  );

  router.get(
    "/me/app-bootstrap",
    asyncHandler(async (req, res) => {
      const payload = await getAppBootstrap(req.auth.sub);
      ok(res, payload);
    })
  );

  router.post(
    "/me/push-token",
    asyncHandler(async (req, res) => {
      const { token } = req.body;
      if (token) {
        await Customer.findByIdAndUpdate(req.auth.sub, { expoPushToken: token });
      }
      ok(res, { registered: true });
    })
  );

  return router;
}

module.exports = { createCustomersRouter };
