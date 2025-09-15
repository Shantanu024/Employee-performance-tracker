const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, companyCode } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // For non-founders, verify company code
    let company = null;
    if (role !== 'founder' && companyCode) {
      company = await Company.findOne({ companyCode });
      if (!company) {
        return res.status(400).json({ error: 'Invalid company code' });
      }
    }

    // Create user
    const user = new User({
      name,
      email,
      password,
      role,
      companyId: company?._id
    });

    await user.save();

    // Add user to company employees if joining existing company
    if (company) {
      company.employees.push(user._id);
      await company.save();
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email })
      .populate('companyId', 'name companyCode')
      .populate('managerId', 'name email');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        managerId: user.managerId,
        points: user.points
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register company (founders only)
router.post('/register-company', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'founder') {
      return res.status(403).json({ error: 'Only founders can register companies' });
    }

    const { name, description, industry, website } = req.body;

    // Check if company exists
    const existingCompany = await Company.findOne({ name });
    if (existingCompany) {
      return res.status(400).json({ error: 'Company name already exists' });
    }

    // Create company
    const company = new Company({
      name,
      description,
      industry,
      website,
      founderId: req.user._id,
      employees: [req.user._id]
    });

    await company.save();

    // Update founder's company
    req.user.companyId = company._id;
    await req.user.save();

    res.status(201).json({
      company,
      message: 'Company registered successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;