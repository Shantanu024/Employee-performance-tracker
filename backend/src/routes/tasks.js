const express = require('express');
const Task = require('../models/Task');
const User = require('../models/User');
const PerformanceLog = require('../models/PerformanceLog');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const router = express.Router();

// Configure multer for file uploads
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'task-submissions',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'mp4', 'avi', 'mov'],
    resource_type: 'auto'
  }
});

const upload = multer({ storage });

// Create task (managers and founders)
router.post('/create', authenticateToken, authorizeRoles('manager', 'founder'), async (req, res) => {
  try {
    const { title, description, points, assignedTo, deadline } = req.body;

    // Verify the assigned user exists and is manageable
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      return res.status(404).json({ error: 'Assigned user not found' });
    }

    // Check if user can assign tasks to this employee
    if (!req.user.subordinates.includes(assignedTo) && req.user.role !== 'founder') {
      return res.status(403).json({ error: 'Cannot assign tasks to this user' });
    }

    const task = new Task({
      title,
      description,
      points,
      assignedTo,
      assignedBy: req.user._id,
      deadline
    });

    await task.save();

    res.status(201).json({
      task,
      message: 'Task created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tasks for current user
router.get('/my-tasks', authenticateToken, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    let query = {};
    
    if (req.user.role === 'employee') {
      query.assignedTo = req.user._id;
    } else {
      // Managers and founders see tasks they assigned
      query.assignedBy = req.user._id;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.deadline = {};
      if (startDate) query.deadline.$gte = new Date(startDate);
      if (endDate) query.deadline.$lte = new Date(endDate);
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .sort('-createdAt');

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit task (employees)
router.post('/:taskId/submit', authenticateToken, upload.array('files', 5), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { submissionNote } = req.body;

    const task = await Task.findById(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to submit this task' });
    }

    // Process uploaded files
    const submissionFiles = req.files.map(file => ({
      url: file.path,
      publicId: file.filename,
      fileType: file.mimetype,
      uploadedAt: new Date()
    }));

    task.status = 'submitted';
    task.submissionFiles = submissionFiles;
    task.submissionNote = submissionNote;
    task.submittedAt = new Date();

    await task.save();

    res.json({
      task,
      message: 'Task submitted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Evaluate task (managers and founders)
router.post('/:taskId/evaluate', authenticateToken, authorizeRoles('manager', 'founder'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { evaluationStatus, evaluationNote, pointsAwarded } = req.body;

    const task = await Task.findById(taskId).populate('assignedTo');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.assignedBy.toString() !== req.user._id.toString() && req.user.role !== 'founder') {
      return res.status(403).json({ error: 'Not authorized to evaluate this task' });
    }

    task.evaluationStatus = evaluationStatus;
    task.evaluationNote = evaluationNote;
    task.evaluatedAt = new Date();
    task.evaluatedBy = req.user._id;

    if (evaluationStatus === 'approved') {
      task.status = 'completed';
      task.pointsAwarded = pointsAwarded || task.points;
      
      // Update user points
      const employee = await User.findById(task.assignedTo);
      employee.points += task.pointsAwarded;
      await employee.save();

      // Update performance log
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let performanceLog = await PerformanceLog.findOne({
        employeeId: task.assignedTo,
        date: today
      });

      if (!performanceLog) {
        performanceLog = new PerformanceLog({
          employeeId: task.assignedTo,
          date: today
        });
      }

      performanceLog.pointsEarned += task.pointsAwarded;
      performanceLog.tasksCompleted += 1;
      performanceLog.taskIds.push(task._id);
      await performanceLog.save();
    } else if (evaluationStatus === 'rejected') {
      task.status = 'rejected';
    }

    await task.save();

    res.json({
      task,
      message: 'Task evaluated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;