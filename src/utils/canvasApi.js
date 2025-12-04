/**
 * Canvas LMS API Client
 * Handles all interactions with the Canvas API
 * Supports multiple courses with automatic discovery
 * 
 * Canvas API Documentation: https://canvas.instructure.com/doc/api/
 */
import { CANVAS_TOKEN, CANVAS_CONFIG } from '../../config.js';
import log from './logger.js';

/**
 * Delay helper for rate limiting
 * @param {number} ms - Milliseconds to wait
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Make a Canvas API request with pagination support and rate limiting
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} params - Query parameters (simple key-value)
 * @param {Object} arrayParams - Array parameters (key -> array of values)
 * @returns {Promise<Array>} All results from paginated response
 */
async function canvasApiRequestWithArrayParams(endpoint, params = {}, arrayParams = {}) {
    const allResults = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const url = new URL(endpoint, CANVAS_CONFIG.baseUrl);
        url.searchParams.set('per_page', '100');
        url.searchParams.set('page', String(page));
        
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }
        
        // Handle array parameters (e.g., include[]=term&include[]=total_scores)
        for (const [key, values] of Object.entries(arrayParams)) {
            if (Array.isArray(values)) {
                for (const value of values) {
                    url.searchParams.append(key, String(value));
                }
            }
        }
        
        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${CANVAS_TOKEN}`,
                    'Accept': 'application/json'
                }
            });
            
            // Handle rate limiting (Canvas uses 403 with X-Rate-Limit-Remaining or 429)
            if (response.status === 429 || response.status === 403) {
                const rateLimitRemaining = response.headers.get('X-Rate-Limit-Remaining');
                const retryAfter = response.headers.get('Retry-After');
                
                if (response.status === 429 || rateLimitRemaining === '0') {
                    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
                    log.warn(`Canvas API rate limit hit, waiting ${waitTime / 1000} seconds...`);
                    await delay(waitTime);
                    continue;
                }
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                log.canvasApi(endpoint, 'error', { status: response.status, statusText: response.statusText, response: errorText });
                break;
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                hasMore = false;
            } else {
                allResults.push(...data);
                page++;
                
                const linkHeader = response.headers.get('Link');
                hasMore = linkHeader && linkHeader.includes('rel="next"');
                
                if (hasMore) {
                    await delay(100);
                }
            }
        } catch (error) {
            log.canvasApi(endpoint, 'error', { error: error.message });
            break;
        }
    }
    
    return allResults;
}

/**
 * Make a Canvas API request with pagination support and rate limiting
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} All results from paginated response
 */
async function canvasApiRequest(endpoint, params = {}) {
    const allResults = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const url = new URL(endpoint, CANVAS_CONFIG.baseUrl);
        url.searchParams.set('per_page', '100');
        url.searchParams.set('page', String(page));
        
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }
        
        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${CANVAS_TOKEN}`,
                    'Accept': 'application/json'
                }
            });
            
            // Handle rate limiting (Canvas uses 403 with X-Rate-Limit-Remaining or 429)
            if (response.status === 429 || response.status === 403) {
                const rateLimitRemaining = response.headers.get('X-Rate-Limit-Remaining');
                const retryAfter = response.headers.get('Retry-After');
                
                if (response.status === 429 || rateLimitRemaining === '0') {
                    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
                    log.warn(`Canvas API rate limit hit, waiting ${waitTime / 1000} seconds...`);
                    await delay(waitTime);
                    continue; // Retry the same page
                }
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                log.canvasApi(endpoint, 'error', { status: response.status, statusText: response.statusText, response: errorText });
                break;
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                hasMore = false;
            } else {
                allResults.push(...data);
                page++;
                
                const linkHeader = response.headers.get('Link');
                hasMore = linkHeader && linkHeader.includes('rel="next"');
                
                // Small delay between pages to avoid rate limiting
                if (hasMore) {
                    await delay(100);
                }
            }
        } catch (error) {
            log.canvasApi(endpoint, 'error', { error: error.message });
            break;
        }
    }
    
    return allResults;
}

/**
 * Fetch all courses the user is enrolled in
 * @returns {Promise<Array>} Array of course objects
 */
export async function fetchAllCourses() {
    try {
        // Canvas API expects include[] parameters for arrays
        const courses = await canvasApiRequestWithArrayParams('/api/v1/courses', {
            enrollment_state: 'active'
        }, {
            'include[]': ['term', 'total_scores']
        });
        
        log.info(`Found ${courses.length} active courses from Canvas`);
        return courses;
    } catch (error) {
        log.error('Failed to fetch courses', error);
        return [];
    }
}

/**
 * Fetch sections for a specific course
 * @param {string|number} courseId - The Canvas course ID
 * @returns {Promise<Array>} Array of section objects
 */
export async function fetchCourseSections(courseId) {
    try {
        const sections = await canvasApiRequest(`/api/v1/courses/${courseId}/sections`);
        return sections;
    } catch (error) {
        log.error(`Failed to fetch sections for course ${courseId}`, error);
        return [];
    }
}

/**
 * Extract course code from section name
 * Section name format: "33141-1" -> returns "33141"
 * Also handles formats like:
 * - "33141-1" -> "33141"
 * - "CS 33141-1" -> "33141"
 * - "33141" -> "33141"
 * - "Section 33141-A" -> "33141"
 * @param {string} sectionName - The section name
 * @returns {string|null} The course code (numbers before first dash) or null
 */
export function extractCourseCode(sectionName) {
    if (!sectionName || typeof sectionName !== 'string') {
        return null;
    }
    
    // Trim whitespace
    const trimmed = sectionName.trim();
    
    // Try to find a sequence of digits, optionally followed by a dash
    // This handles cases like "33141-1", "CS 33141-1", "Section 33141"
    const match = trimmed.match(/(\d{4,})/);
    
    if (match) {
        return match[1];
    }
    
    // Fallback: match any digits at the start
    const startMatch = trimmed.match(/^(\d+)/);
    return startMatch ? startMatch[1] : null;
}

/**
 * Fetch assignments from Canvas API for a specific course (with pagination)
 * @param {string} courseId - The Canvas course ID
 * @returns {Promise<Array>} Array of assignment objects
 */
export async function fetchAssignmentsForCourse(courseId) {
    const allAssignments = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const url = new URL(
            `/api/v1/courses/${courseId}/assignments`,
            CANVAS_CONFIG.baseUrl
        );
        
        url.searchParams.set('per_page', String(CANVAS_CONFIG.assignmentsPerPage));
        url.searchParams.set('page', String(page));
        url.searchParams.set('order_by', 'due_at');
        
        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${CANVAS_TOKEN}`,
                    'Accept': 'application/json'
                }
            });
            
            // Handle rate limiting
            if (response.status === 429 || response.status === 403) {
                const rateLimitRemaining = response.headers.get('X-Rate-Limit-Remaining');
                const retryAfter = response.headers.get('Retry-After');
                
                if (response.status === 429 || rateLimitRemaining === '0') {
                    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
                    log.warn(`Canvas API rate limit hit, waiting ${waitTime / 1000} seconds...`);
                    await delay(waitTime);
                    continue;
                }
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                log.canvasApi(`/courses/${courseId}/assignments`, 'error', { status: response.status, response: errorText });
                break;
            }
            
            const assignments = await response.json();
            
            if (!Array.isArray(assignments) || assignments.length === 0) {
                hasMore = false;
            } else {
                allAssignments.push(...assignments);
                page++;
                
                const linkHeader = response.headers.get('Link');
                hasMore = linkHeader && linkHeader.includes('rel="next"');
                
                if (hasMore) {
                    await delay(100);
                }
            }
        } catch (error) {
            log.error(`Failed to fetch assignments for course ${courseId}`, error);
            break;
        }
    }
    
    // Filter to only include assignments with future due dates
    const now = new Date();
    const filtered = allAssignments.filter(a => {
        if (!a.due_at) return false;
        return new Date(a.due_at) > now;
    });
    
    log.debug(`Fetched ${filtered.length} upcoming assignments for course ${courseId}`);
    return filtered;
}

// fetchAllAssignmentsForCourse is now merged into fetchAssignmentsForCourse
// Keeping alias for backward compatibility
export const fetchAllAssignmentsForCourse = fetchAssignmentsForCourse;

/**
 * Fetch all courses with their sections, terms, and check for assignments
 * Returns only courses that have assignments
 * @returns {Promise<Array>} Array of course info objects with section/term data
 */
export async function fetchCoursesWithAssignments() {
    const courses = await fetchAllCourses();
    const coursesWithAssignments = [];
    
    log.info(`Checking ${courses.length} courses for assignments...`);
    
    for (const course of courses) {
        // Small delay to avoid rate limiting
        await delay(200);
        
        // Check if course has assignments
        const assignments = await fetchAssignmentsForCourse(course.id);
        
        if (assignments.length === 0) {
            log.debug(`Skipping course ${course.id} (${course.name}) - no upcoming assignments`);
            continue;
        }
        
        // Fetch sections for this course
        const sections = await fetchCourseSections(course.id);
        const section = sections[0]; // Use first section
        
        let courseCode = null;
        if (section && section.name) {
            courseCode = extractCourseCode(section.name);
        }
        
        // If no section code found, try to extract from course code
        if (!courseCode && course.course_code) {
            courseCode = extractCourseCode(course.course_code);
        }
        
        // Fallback to course ID if no code found
        if (!courseCode) {
            courseCode = String(course.id);
        }
        
        // Sanitize term name for Discord category (remove special chars)
        let termName = course.term?.name || 'Default';
        termName = termName.replace(/[^\w\s-]/g, '').trim() || 'Default';
        
        coursesWithAssignments.push({
            courseId: course.id,
            courseName: course.name,
            courseCode: courseCode,
            termName: termName,
            sectionName: section?.name || null,
            assignmentCount: assignments.length
        });
        
        log.info(`Course ${course.id}: code=${courseCode}, term=${termName}, assignments=${assignments.length}`);
    }
    
    return coursesWithAssignments;
}

/**
 * Transform Canvas assignment to our storage format
 * @param {Object} assignment - Raw Canvas assignment object
 * @param {string} courseId - The course ID this assignment belongs to
 * @returns {Object} Transformed assignment object
 */
export function transformAssignment(assignment, courseId = null) {
    return {
        id: assignment.id,
        courseId: courseId,
        name: assignment.name || 'Untitled Assignment',
        description: assignment.description || '',
        deadline: assignment.due_at,
        pointsPossible: assignment.points_possible ?? null,
        submissionTypes: Array.isArray(assignment.submission_types) ? assignment.submission_types : [],
        htmlUrl: assignment.html_url || '',
        remindersSent: []
    };
}

/**
 * Check if an assignment has been updated
 * @param {Object} stored - Stored assignment
 * @param {Object} fetched - Fetched assignment from Canvas
 * @returns {boolean} True if assignment was updated
 */
export function hasAssignmentChanged(stored, fetched) {
    const storedDeadline = stored.deadline ? new Date(stored.deadline).getTime() : 0;
    const fetchedDeadline = fetched.due_at ? new Date(fetched.due_at).getTime() : 0;
    
    return storedDeadline !== fetchedDeadline ||
           stored.pointsPossible !== fetched.points_possible ||
           stored.name !== fetched.name;
}

// Legacy export for backward compatibility
export { fetchAssignmentsForCourse as fetchAssignments };
