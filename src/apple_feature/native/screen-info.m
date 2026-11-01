#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ApplicationServices/ApplicationServices.h>
#import <unistd.h>

// Read geometry only, and never request Accessibility or screen-recording access.
static NSArray<NSValue *> *applicationMenuRects(void) {
    if (!AXIsProcessTrusted()) return nil;
    pid_t pid = NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;
    if (pid <= 0) return nil;
    AXUIElementRef app = AXUIElementCreateApplication(pid);
    AXUIElementSetMessagingTimeout(app, 0.1);
    CFTypeRef menu = NULL, children = NULL;
    NSMutableArray *rects = nil;
    if (AXUIElementCopyAttributeValue(app, kAXMenuBarAttribute, &menu) == kAXErrorSuccess &&
        AXUIElementCopyAttributeValue((AXUIElementRef)menu, kAXChildrenAttribute, &children) == kAXErrorSuccess) {
        rects = [NSMutableArray array];
        for (id child in (__bridge NSArray *)children) {
            CFTypeRef position = NULL, size = NULL;
            CGPoint point; CGSize dimensions;
            BOOL valid = AXUIElementCopyAttributeValue((__bridge AXUIElementRef)child, kAXPositionAttribute, &position) == kAXErrorSuccess &&
                AXUIElementCopyAttributeValue((__bridge AXUIElementRef)child, kAXSizeAttribute, &size) == kAXErrorSuccess &&
                AXValueGetValue((AXValueRef)position, kAXValueCGPointType, &point) &&
                AXValueGetValue((AXValueRef)size, kAXValueCGSizeType, &dimensions);
            if (valid) [rects addObject:[NSValue valueWithRect:NSMakeRect(point.x, point.y, dimensions.width, dimensions.height)]];
            else rects = nil; // Partial metadata must not imply that the rest is empty.
            if (position) CFRelease(position);
            if (size) CFRelease(size);
            if (!rects) break;
        }
        if (!rects.count) rects = nil;
    }
    if (children) CFRelease(children);
    if (menu) CFRelease(menu);
    CFRelease(app);
    return rects;
}

static void excludeRect(CGRect rect, CGRect bar, CGFloat center, CGFloat *left, CGFloat *right) {
    if (!CGRectIntersectsRect(rect, bar) || CGRectIsEmpty(rect)) return;
    CGFloat min = CGRectGetMinX(rect) - CGRectGetMinX(bar);
    CGFloat max = CGRectGetMaxX(rect) - CGRectGetMinX(bar);
    if (max <= center) *left = MAX(*left, max);
    else if (min >= center) *right = MIN(*right, min);
    else { *left = center; *right = center; }
}

int main(void) {
    @autoreleasepool {
        NSMutableArray *result = [NSMutableArray array];
        NSArray *menus = applicationMenuRects();
        NSArray *windows = CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID));
        for (NSScreen *screen in NSScreen.screens) {
            NSNumber *displayID = screen.deviceDescription[@"NSScreenNumber"];
            CGFloat top = 0, width = 0, x = 0;
            if (@available(macOS 12.0, *)) {
                top = screen.safeAreaInsets.top;
                NSRect left = screen.auxiliaryTopLeftArea;
                NSRect right = screen.auxiliaryTopRightArea;
                if (top > 0 && !NSIsEmptyRect(left) && !NSIsEmptyRect(right)) {
                    x = NSMaxX(left) - NSMinX(screen.frame);
                    width = NSMinX(right) - NSMaxX(left);
                }
            }
            CGFloat left = x, right = x + width;
            if (top > 0 && width > 0) {
                CGRect bar = CGDisplayBounds(displayID.unsignedIntValue); bar.size.height = top;
                CGFloat center = x + width / 2;
                // AX may describe the menu on another monitor only.
                for (NSValue *value in menus) {
                    if (CGRectIntersectsRect(NSRectToCGRect(value.rectValue), bar)) { left = 0; break; }
                }
                if (windows.count) right = CGRectGetWidth(bar);
                for (NSValue *value in menus) excludeRect(NSRectToCGRect(value.rectValue), bar, center, &left, &right);
                for (NSDictionary *window in windows) {
                    int layer = [window[(__bridge NSString *)kCGWindowLayer] intValue];
                    if ([window[(__bridge NSString *)kCGWindowOwnerPID] intValue] == getppid() ||
                        layer < CGWindowLevelForKey(kCGMainMenuWindowLevelKey) ||
                        [window[(__bridge NSString *)kCGWindowAlpha] doubleValue] == 0) continue;
                    CGRect rect;
                    if (!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)window[(__bridge NSString *)kCGWindowBounds], &rect)) continue;
                    // The menu-bar backdrop is a full-width window, not a menu item.
                    if (layer == CGWindowLevelForKey(kCGMainMenuWindowLevelKey) && CGRectGetWidth(rect) >= CGRectGetWidth(bar) && CGRectGetHeight(rect) <= top) continue;
                    excludeRect(rect, bar, center, &left, &right);
                }
            }
            [result addObject:@{ @"id": displayID, @"top": @(top), @"notchX": @(x), @"notchWidth": @(width),
                @"menuBarLeft": @(left), @"menuBarRight": @(right) }];
        }
        NSData *data = [NSJSONSerialization dataWithJSONObject:result options:0 error:nil];
        fwrite(data.bytes, 1, data.length, stdout);
    }
    return 0;
}
