const express = require('express');
const PerformanceLog = require('../models/PerformanceLog');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Log work hours
router.post('/log-hours', authenticateToken, async (req, res) => {
  try {
    const { date, hoursWorked } = req.body;
    
    const logDate = new Date(date);
    logDate.setHours(0, 0, 0, 0);

    let performanceLog = await PerformanceLog.findOne({
      employeeId: req.user._id,
      date: logDate
    });

    if (!performanceLog) {
      performanceLog = new PerformanceLog({
        employeeId: req.user._id,
        date: logDate
      });
    }

    performanceLog.hoursWorked = hoursWorked;
    await performanceLog.save();

    res.json({
      performanceLog,
      message: 'Hours logged successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get performance data
router.get('/data', authenticateToken, async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    
    let targetUserId = req.user._id;
    
    // Managers and founders can view others' performance
    if (userId && (req.user.role === 'manager' || req.user.role === 'founder')) {
      targetUserId = userId;
    }

    const query = {
      employeeId: targetUserId
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const performanceLogs = await PerformanceLog.find(query)
      .sort('date')
      .populate('taskIds', 'title points');

    // Calculate aggregated stats
    const stats = {
      totalHours: performanceLogs.reduce((sum, log) => sum + log.hoursWorked, 0),
      totalPoints: performanceLogs.reduce((sum, log) => sum + log.pointsEarned, 0),
      totalTasks: performanceLogs.reduce((sum, log) => sum + log.tasksCompleted, 0),
      averageHoursPerDay: 0,
      averagePointsPerDay: 0
    };

    if (performanceLogs.length > 0) {
      stats.averageHoursPerDay = stats.totalHours / performanceLogs.length;
      stats.averagePointsPerDay = stats.totalPoints / performanceLogs.length;
    }

    res.json({
      logs: performanceLogs,
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get team performance (managers and founders)
router.get('/team', authenticateToken, authorizeRoles('manager', 'founder'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get all subordinates
    const subordinates = await User.find({
      _id: { $in: req.user.subordinates }
    }).select('name email points');

    const query = {
      employeeId: { $in: req.user.subordinates }
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const performanceLogs = await PerformanceLog.find(query)
      .populate('employeeId', 'name email')
      .sort('date');

    // Group by employee
    const teamPerformance = {};
    
    subordinates.forEach(emp => {
      teamPerformance[emp._id] = {
        employee: emp,
        totalHours: 0,
        totalPoints: 0,
        totalTasks: 0,
        logs: []
      };
    });

    performanceLogs.forEach(log => {
      const empId = log.employeeId._id.toString();
      if (teamPerformance[empId]) {
        teamPerformance[empId].totalHours += log.hoursWorked;
        teamPerformance[empId].totalPoints += log.pointsEarned;
        teamPerformance[empId].totalTasks += log.tasksCompleted;
        teamPerformance[empId].logs.push(log);
      }
    });

    res.json(Object.values(teamPerformance));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;