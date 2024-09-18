
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../model/users'); // Ensure this path is correct
const Comment = require('../model/comments'); // Ensure this path is correct
const Like = require('../model/likes'); // Ensure this path is correct

const authenticateToken = require('../middleware/auth'); // Ensure this path is correct
const upload = require('../middleware/upload.js'); // Ensure this path is correct
const Post = require('../model/posts'); // Adjust the path as necessary
const mongoose = require('mongoose');



// Display registration form
router.get('/user/register', (req, res) => {
    res.render('./user/register'); // Assuming register.ejs is in your views folder
});

router.get('/user/login', (req, res) => {
    res.render('./user/login'); // Assuming register.ejs is in your views folder
});

router.post('/user/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if email already exists in the database
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.render('./user/register', { errorMessage: 'Email already exists' });
        }

        // Validate the password
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
        if (!passwordRegex.test(password)) {
            return res.render('./user/register', { errorMessage: 'Password must be at least 6 characters long and contain at least one uppercase and one lowercase letter' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user document
        const newUser = new User({
            name: name,
            email: email,
            password: hashedPassword
        });

        // Save the new user document to the database
        await newUser.save();
        console.log('User registered successfully');

        // Redirect to a success page or login page
        res.redirect('/user/login');
    } catch (error) {
        console.error('Error registering user:', error);
        res.render('./user/register', { errorMessage: 'Server error' });
    }
});


router.post('/user/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the user exists in the database
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.render('./user/login', { errorMessage: 'User not found' });
        }

        // Validate password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.render('./user/login', { errorMessage: 'Invalid password' });
        }

        // Issue JWT token
        const payload = {
            user: {
                id: user.id
            }
        };

        const jwtSecret = '4715aed3c946f7b0a38e6b534a9583628d84e96d10fbc04700770d572af3dce43625dd'; // Hardcoded JWT secret
        jwt.sign(payload, jwtSecret, { expiresIn: '1h' }, (err, token) => {
            if (err) throw err;
            res.cookie('token', token, { httpOnly: true }); // Set cookie with JWT token
            res.redirect('/user/dashboard');
        });

    } catch (error) {
        console.error('Error logging in user:', error);
        res.render('login', { errorMessage: 'Server error' });
    }
});

// Display dashboard
router.get('/user/dashboard', authenticateToken, async (req, res) => {
    try {
        // Fetch user information using the ID stored in req.user
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.render('./user/dashboard', { user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Server error');
    }
});



router.get('/user/profileedit', authenticateToken, async (req, res) => {
    try {
        // Fetch user information using the ID stored in req.user
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.render('./user/profileedit', { user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Server error');
    }
});
router.get('/user/blog', authenticateToken, async (req, res) => {
    try {
        // Fetch user information using the ID stored in req.user
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Fetch all posts authored by this user
        const posts = await Post.find({ author: user._id }).populate('author').exec();

        // Render the blog view, passing both user and posts data
        res.render('./user/blog', { user, posts });
    } catch (error) {
        console.error('Error fetching user or posts:', error);
        res.status(500).send('Server error');
    }
});

// POST route to handle profile updates
router.post('/profile', authenticateToken, upload.single('picture'), async (req, res) => {
    try {
        const { name, bio } = req.body;
        const picture = req.file ? '/images/' + req.file.filename : null; // Construct path to store in database

        // Find the user by ID and update the fields
        const updatedFields = { name, bio };
        if (picture) {
            updatedFields.picture = picture;
        }

        const user = await User.findByIdAndUpdate(req.user.id, updatedFields, { new: true });

        if (!user) {
            return res.status(404).send('User not found');
        }

        res.render('./user/profileedit', { user, successMessage: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).send('Server error');
    }
});


// Handle logout
router.get('/logout', (req, res) => {
    res.clearCookie('token'); // Clear the token cookie
    res.redirect('/user/login'); // Redirect to login page after logout
});

router.get('/user/comment', authenticateToken, async (req, res) => {
    try {
        // Fetch user information using the ID stored in req.user
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Fetch all posts authored by this user
        const posts = await Post.find({ author: user._id }).populate('author').exec();

        // Fetch comments for these posts
        const comments = await Comment.find({ post: { $in: posts.map(post => post._id) } })
            .populate('post')
            .populate('user')
            .exec();

        res.render('./user/comment', { user, posts, comments });
    } catch (error) {
        console.error('Error fetching user or comments:', error);
        res.status(500).send('Server error');
    }
});
// Route to approve a comment
router.post('/comments/approve', authenticateToken, async (req, res) => {
    try {
        const { commentId } = req.body;
        await Comment.findByIdAndUpdate(commentId, { approved: true });
        res.redirect('/user/comment');
    } catch (error) {
        console.error('Error approving comment:', error);
        res.status(500).send('Server error');
    }
});

// Route to disapprove a comment
router.post('/comments/disapprove', authenticateToken, async (req, res) => {
    try {
        const { commentId } = req.body;
        await Comment.findByIdAndUpdate(commentId, { approved: false });
        res.redirect('/user/comment');
    } catch (error) {
        console.error('Error disapproving comment:', error);
        res.status(500).send('Server error');
    }
});

router.post('/post/:id/comment', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        const postId = req.params.id;

        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            // If user not found, handle it (you might want to create a new user or return an error)
            return res.status(400).send('User not found');
        }

        // Create a new comment
        const newComment = new Comment({
            post: postId,
            user: user._id, // Associate comment with user ID
            content: message
        });

        // Save the comment
        await newComment.save();

        // Optionally, you might want to redirect to the post page or send a success message
        res.redirect(`/post/${postId}`);

    } catch (error) {
        console.error('Error saving comment:', error);
        res.status(500).send('Server error');
    }
});

router.post('/post/:id/like', async (req, res) => {
    try {
        const postId = req.params.id;

        // Check if the user already liked the post
        const existingLike = await Like.findOne({ blog_id: postId });

        if (existingLike) {
            // Post is already liked, send a warning message
            return res.json({ success: false, message: 'Post already liked' });
        }

        // Create a new like entry
        const newLike = new Like({
            blog_id: postId
        });

        await newLike.save();

        // Update the post's like count
        const post = await Post.findById(postId);
        post.likeCount = await Like.countDocuments({ blog_id: postId });
        await post.save();

        // Send a success message
        res.json({ success: true, message: 'Post liked successfully' });
    } catch (error) {
        console.error('Error liking the post:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


router.get('/post/:id', async (req, res) => {
    try {
        const postId = req.params.id;

        // Fetch the post by ID
        const post = await Post.findById(postId)
            .populate('author', 'name picture email')
            .exec();

        // Fetch approved comments and related likes
        const comments = await Comment.find({ post: postId, approved: true })
            .populate('user', 'name picture')
            .exec();

        // Count approved comments and likes
        const commentCount = comments.length;
        const likeCount = await Like.countDocuments({ blog_id: postId });

        // Add counts to the post object
        post.commentCount = commentCount;
        post.likeCount = likeCount;

        // Fetch related posts with the same category
        const relatedPosts = await Post.find({
            category: post.category,
            _id: { $ne: postId } // Exclude the current post from the results
        })
            .limit(3) // Limit the number of related posts (adjust as needed)
            .exec();

        // Debugging statements
        console.log('Post:', post);
        console.log('Comments:', comments);
        console.log('Comment Count:', commentCount);
        console.log('Like Count:', likeCount);

        // Render the post detail view
        res.render('blog', {
            post,
            comments,
            relatedPosts // Pass related posts to the view
        });

    } catch (error) {
        console.error('Error fetching post details:', error);
        res.status(500).send('Server error');
    }
});

router.get('/', async (req, res) => {
    try {
        // Fetch all blog posts with populated author details
        const posts = await Post.find({})
            .populate('author', 'name picture') // Populate author field with specific fields
            .exec();

        // Fetch all approved comments for these posts
        const comments = await Comment.find({ post: { $in: posts.map(post => post._id) }, approved: true })
            .exec();

        // Fetch all likes for these posts
        const likes = await Like.find({ blog_id: { $in: posts.map(post => post._id) } })
            .exec();

        // Create a map for quick lookup of comments and likes count per post
        const commentCountMap = comments.reduce((acc, comment) => {
            acc[comment.post] = (acc[comment.post] || 0) + 1;
            return acc;
        }, {});

        const likeCountMap = likes.reduce((acc, like) => {
            acc[like.blog_id] = (acc[like.blog_id] || 0) + 1;
            return acc;
        }, {});

        // Add comment and like counts to posts
        posts.forEach(post => {
            post.commentCount = commentCountMap[post._id] || 0;
            post.likeCount = likeCountMap[post._id] || 0;
        });

        // Sort posts by the total number of likes and comments (most popular first)
        const sortedPosts = posts.sort((a, b) => {
            const aEngagement = a.likeCount + a.commentCount;
            const bEngagement = b.likeCount + b.commentCount;
            return bEngagement - aEngagement;
        });

        // Limit to top 5 posts or any number you prefer
        const topPosts = sortedPosts.slice(0, 5);

        // Fetch all Programming, Writing, Technology, and Other category posts
        const programmingPosts = await Post.find({ category: 'Programming' })
            .populate('author', 'name picture')
            .exec();

        const writingPosts = await Post.find({ category: 'Writing' })
            .populate('author', 'name picture')
            .exec();

        const technologyPosts = await Post.find({ category: 'Technology' })
            .populate('author', 'name picture')
            .exec();

        const otherPosts = await Post.find({ category: 'Other' })
            .populate('author', 'name picture')
            .exec();

        // Render the index view with all the fetched data
        res.render('index', {
            posts: topPosts,
            programmingPosts: programmingPosts,
            writingPosts: writingPosts,
            technologyPosts: technologyPosts,
            otherPosts: otherPosts
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Server error');
    }
});







router.get('/blog', (req, res) => {
    res.render('blog'); // Assuming register.ejs is in your views folder
});

// Display registration form
router.get('/category', (req, res) => {
    res.render('category'); // Assuming register.ejs is in your views folder
});



router.post('/posts', upload.single('picture'), async (req, res) => {
    try {
        const { title, content, category, tags, authorId } = req.body;
        const picture = req.file ? '/images/' + req.file.filename : null; // Get picture path

        // Log the extracted data for debugging
        console.log('Title:', title);
        console.log('Content:', content);
        console.log('Category:', category);
        console.log('Tags:', tags);
        console.log('Author ID:', authorId);
        console.log('Picture:', picture);

        // Ensure authorId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(authorId)) {
            throw new Error('Invalid author ID');
        }

        // Create the post
        const post = new Post({
            title,
            content,
            category,
            tags: tags.split(',').map(tag => tag.trim()),
            author: authorId, // Set the author from the form
            picture // Include picture path
        });

        await post.save();
        res.redirect('/blog');
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).send('Server error');
    }
});

router.post('/posts/update', upload.single('picture'), async (req, res) => {
    try {
        const { postId, title, content, category, tags } = req.body;
        const picture = req.file ? '/images/' + req.file.filename : null; // Get picture path

        // Find the post and update it
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).send('Post not found');
        }

        post.title = title;
        post.content = content;
        post.category = category;
        post.tags = tags.split(',').map(tag => tag.trim());
        post.picture = picture || post.picture; // Update picture if a new one is provided

        await post.save();
        res.redirect('/user/blog');
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).send('Server error');
    }
});

router.post('/posts/delete', async (req, res) => {
    try {
        const { postId } = req.body;

        // Find the post and delete it
        await Post.findByIdAndDelete(postId);

        res.redirect('/user/blog');
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;