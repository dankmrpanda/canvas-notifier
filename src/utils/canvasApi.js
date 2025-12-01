/**
 * Canvas LMS API Client
 * Handles all interactions with the Canvas API
 * Supports multiple courses
 * 
 * Canvas API Documentation: https://canvas.instructure.com/doc/api/
 */
import { CANVAS_TOKEN, CANVAS_CONFIG } from '../../config.js';

/**
 * Fetch assignments from Canvas API for a specific course
 * @param {string} courseId - The Canvas course ID
 * @returns {Promise<Array>} Array of assignment objects
 */
export async function fetchAssignmentsForCourse(courseId) {
    const url = new URL(
        `/api/v1/courses/${courseId}/assignments`,
        CANVAS_CONFIG.baseUrl
    );
    
    url.searchParams.set('per_page', String(CANVAS_CONFIG.assignmentsPerPage));
    url.searchParams.set('order_by', 'due_at');
    
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CANVAS_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Canvas API error for course ${courseId}: ${response.status} ${response.statusText}`);
            console.error(`Response: ${errorText}`);
            return [];
        }
        
        const assignments = await response.json();
        
        // Filter to only include assignments with future due dates
        const now = new Date();
        return assignments.filter(a => {
            if (!a.due_at) return false;
            return new Date(a.due_at) > now;
        });
    } catch (error) {
        console.error(`Failed to fetch assignments for course ${courseId}:`, error.message);
        return [];
    }
}

/**
 * Fetch all assignments with pagination support for a specific course
 * @param {string} courseId - The Canvas course ID
 * @returns {Promise<Array>} Array of all assignment objects
 */
export async function fetchAllAssignmentsForCourse(courseId) {
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
            
            if (!response.ok) {
                console.error(`Canvas API error on page ${page} for course ${courseId}: ${response.status}`);
                break;
            }
            
            const assignments = await response.json();
            
            if (assignments.length === 0) {
                hasMore = false;
            } else {
                allAssignments.push(...assignments);
                page++;
                
                const linkHeader = response.headers.get('Link');
                hasMore = linkHeader && linkHeader.includes('rel="next"');
            }
        } catch (error) {
            console.error(`Failed to fetch page ${page} for course ${courseId}:`, error.message);
            break;
        }
    }
    
    const now = new Date();
    return allAssignments.filter(a => {
        if (!a.due_at) return false;
        return new Date(a.due_at) > now;
    });
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
